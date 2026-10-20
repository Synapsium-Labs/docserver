# L2 Task 7b: mutation rows (shared services)

Each guard of Task 7b, deleted or inverted once, with the tests that go red: the registries and events
(`src/enhance/registry.ts`), overlays, the keyboard layer, navigation and the position seam, relayout, reveal, heading
controls, the bar's skeleton, the folds' members API and their use of the services, the page and the facts panel's
seam, the lifecycle's wiring and the prefs path, the stylesheet's markers, RF3's large plan, and the fonts relayout in
a real browser; then four earlier rows whose code this task rewrote, and the review round's rows. Measured 2026-10-20
on branch `l2-t7b-services`, on its code after the review round (commit `bb421f8`), every row, L2-T7b-M1 to
L2-T7b-M279; L2-T7b-M177 and M178 again on `2380c98`, which only adds a case to one of their tests (below). 277 were
measured, all red (`rc=1`); two are reported (below).

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with three changes: the two its results section records (a
512 MiB output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict), and one
for this round that changes only what it prints: it also keeps vitest's `Errors` count line, `Unhandled Rejection`
and `TypeError` lines, so a row that a test run fails only through an unhandled error shows why. Each row is applied
to its own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked
from the checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs
exactly once in its file. The rows ran with `DOCREADER_BROWSERS=chromium` (C45): the browser rows ran in Chromium, and
WebKit was reported as excluded. They ran in one batch split four ways in parallel. The checkout was never edited:
`git status --porcelain` read the same (empty) before and after, and so did the hash of `git diff` and `HEAD`. The Red
column gives the count line and the failing tests the run printed (at most five here; the run prints at most 20
failing lines). A count line that does not add up to its total is no verdict: none here.

Notes on the measurement.
- A first pass over the rows, on the tree before the last commit of the first round, left three green. L2-T7b-M199
  (join takes a node once) was green because its case offered the element after a heading, which is the fold's note,
  not a member: the case now offers a member of another section. L2-T7b-M119 and L2-T7b-M230 were green because their
  checks were redundant (reveal(), the journal, the events and relayout already refuse everything once the instance is
  not live); both checks were removed, and the two rows are reported below rather than dropped.
- Before measuring, every check that no case could redden was removed rather than left unmeasured: a lookup's type
  check where a Map or WeakMap answers nothing anyway, the listeners' and revealers' "not live" checks where nothing
  they hold can run after destroy, the keyboard layer's check that it is made while live (it always is), and a few
  others; the commits say which.
- The rows that mutate the shared name check (`isName`) are measured through the index's cases; the same check guards
  term names and figure numbers.
- The review round. Its fixes rewrote the code of nine rows, which now name the new code: L2-T7b-M34 and M36 (terms
  and the figure check), M176 and M181 to M183 (a heading's text), and M185 to M187 (the skip link, which now goes to
  the document's first node). Two rows of the first round had count lines from runs that did not finish their file
  (L2-T7b-M56 and M136); every row here was measured again, so the counts are complete. A first pass over the round's
  own rows (L2-T7b-M242 to M279) left two green: M251 (a fold's name leaves out chrome) and M257 (a new definition
  drops the cached copy). Each got a case (a probe that runs just before folds and puts a read mark's control in a
  heading; a term's definitions read before a later one is added), and both are red here.
- On `bb421f8`, L2-T7b-M177 (a heading with a label keeps it) was green: once a heading's text is read as written,
  its own label equals the one editorial gives a numbered section, so the case could not tell them apart. The case now
  gives a heading an aria-label of its own (`2380c98`); M177 and M178, the two rows that read that case, are red there.
- Three rows of the round go red only through vitest's check for unhandled errors, every test passing: L2-T7b-M269
  (the list check), M270 (the optional chain) and M277 (the listener's try). Each mutation makes the fonts wait throw
  inside a promise callback; the wait still ends at its bound, so no assertion sees a difference, but the run fails
  with the `TypeError` the Red column shows. They are red, and they are named here so a reader does not mistake the
  count line for green.

## Registries and events: `src/enhance/registry.ts` (L2-T7b-M1 to L2-T7b-M64)

The ID index (the first definition wins, document order, RF1's keys, its refusals, its caches and its frozen entries),
terms, blocks, figures, the plan and page slots, and events (order, a cancel during an emit, faults, and a destroy in
a listener).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M1 | index.define refuses a missing entry | `src/enhance/registry.ts` | `      if (typeof e !== 'object' \|\| e === null) throw new Error('docreader: index.define takes an ent…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: refuses a missing entry, a group that is not text and a target that is not an element; keeps a copy of the heads" |
| L2-T7b-M2 | an ID, a term name or a figure number is not empty | `src/enhance/registry.ts` | `typeof v === 'string' && v !== '' && v.length <= NAME_MAX` → `typeof v === 'string' && v.length <= NAME_MAX` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads"; "figures: one entry per figure element, in document order" |
| L2-T7b-M3 | an ID, a term name or a figure number is at most 200 code units | `src/enhance/registry.ts` | `typeof v === 'string' && v !== '' && v.length <= NAME_MAX` → `typeof v === 'string' && v !== ''` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads"; "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M4 | an index entry has an id | `src/enhance/registry.ts` | `      if (!isName(id)) throw new Error('docreader: an index entry has an id of 1 to 200 code units')…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M5 | an index entry's kind is one of four | `src/enhance/registry.ts` | `      if (!INDEX_KINDS.includes(kind)) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M6 | an index entry has a title | `src/enhance/registry.ts` | `if (typeof title !== 'string' \|\| typeof group !== 'string')` → `if (typeof group !== 'string')` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M7 | an index entry has a group | `src/enhance/registry.ts` | `if (typeof title !== 'string' \|\| typeof group !== 'string')` → `if (typeof title !== 'string')` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: refuses a missing entry, a group that is not text and a target that is not an element; keeps a copy of the heads" |
| L2-T7b-M8 | an index entry's status is a colour role or null | `src/enhance/registry.ts` | `      if (status !== null && status !== 'ok' && status !== 'wait' && status !== 'no' && status !== '…` → `      if (false) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M9 | an index entry's target is an element | `src/enhance/registry.ts` | `      if (!isElement(target) \|\| target === root \|\| !root.contains(target)` → `      if (target === root \|\| !root.contains(target)` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: refuses a missing entry, a group that is not text and a target that is not an element; keeps a copy of the heads" |
| L2-T7b-M10 | an index entry's target is not the root | `src/enhance/registry.ts` | `      if (!isElement(target) \|\| target === root \|\| !root.contains(target)` → `      if (!isElement(target) \|\| !root.contains(target)` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M11 | an index entry's target is inside the root | `src/enhance/registry.ts` | `      if (!isElement(target) \|\| target === root \|\| !root.contains(target) \|\| target.hasAttribute(CHR…` → `      if (!isElement(target) \|\| target === root \|\| target.hasAttribute(CHROME_ATTR))` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M12 | an index entry's target is not chrome | `src/enhance/registry.ts` | ` \|\| target.hasAttribute(CHROME_ATTR)) {` → `) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M13 | an index entry's row is inside the root, or null | `src/enhance/registry.ts` | `      if (row !== null && !(isElement(row) && root.contains(row))) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M14 | an index entry's heads are strings | `src/enhance/registry.ts` | `      if (!Array.isArray(heads) \|\| !heads.every((h) => typeof h === 'string')) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads" |
| L2-T7b-M15 | the first definition of an ID wins | `src/enhance/registry.ts` | `      if (byId.has(id)) return false; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the first definition of an ID wins; all() is in document order, whatever the definition order" |
| L2-T7b-M16 | an index entry is frozen | `src/enhance/registry.ts` | `const entry: IndexEntry = Object.freeze({ id, kind, title, status, group, target, row, heads: Object…` → `const entry: IndexEntry = { id, kind, title, status, group, target, row, heads: Object.freeze([...he…` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the first definition of an ID wins; all() is in document order, whatever the definition order" |
| L2-T7b-M17 | an index entry keeps a frozen copy of the heads | `src/enhance/registry.ts` | `heads: Object.freeze([...heads]) });` → `heads });` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: refuses a missing entry, a group that is not text and a target that is not an element; keeps a copy of the heads" |
| L2-T7b-M18 | of() keeps the first entry of a target | `src/enhance/registry.ts` | `      if (!byEl.has(target)) byEl.set(target, entry);` → `      byEl.set(target, entry);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: of() keeps the first entry of a target and finds an entry by its row; all() sees a later definition" |
| L2-T7b-M19 | of() finds an entry by its row | `src/enhance/registry.ts` | `      if (row !== null && !byEl.has(row)) byEl.set(row, entry); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: of() keeps the first entry of a target and finds an entry by its row; all() sees a later definition" |
| L2-T7b-M20 | all() sees a later definition (the index's cache is dropped) | `src/enhance/registry.ts` | `      sorted = null; ⏎       return true; ⏎     }, ⏎     get:` → `      return true; ⏎     }, ⏎     get:` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "index: of() keeps the first entry of a target and finds an entry by its row; all() sees a later definition" |
| L2-T7b-M21 | all() is in document order | `src/enhance/registry.ts` | `        list.sort((a, b) => (a.target === b.target ? 0 : before(a.target, b.target) ? -1 : 1)); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the first definition of an ID wins; all() is in document order, whatever the definition order" |
| L2-T7b-M22 | all() is frozen | `src/enhance/registry.ts` | `        sorted = Object.freeze(list);` → `        sorted = list;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the first definition of an ID wins; all() is in document order, whatever the definition order" |
| L2-T7b-M23 | terms.define refuses a missing term | `src/enhance/registry.ts` | `      if (typeof t !== 'object' \|\| t === null) throw new Error('docreader: terms.define takes a term…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M24 | a term name is not blank | `src/enhance/registry.ts` | `      if (!isName(name) \|\| termKey(name) === '') throw` → `      if (!isName(name)) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M25 | a term has a name of 1 to 200 code units | `src/enhance/registry.ts` | `      if (!isName(name) \|\| termKey(name) === '') throw` → `      if (termKey(name) === '') throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M26 | a term's exact is a boolean | `src/enhance/registry.ts` | `if (typeof exact !== 'boolean' \|\| typeof section !== 'string')` → `if (typeof section !== 'string')` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M27 | a term's section is a string | `src/enhance/registry.ts` | `if (typeof exact !== 'boolean' \|\| typeof section !== 'string')` → `if (typeof exact !== 'boolean')` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M28 | a term's target is inside the root | `src/enhance/registry.ts` | `      if (!isElement(target) \|\| !root.contains(target)) throw new Error('docreader: a term\'s target` → `      if (false) throw new Error('docreader: a term\'s target` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M29 | a term has a definition | `src/enhance/registry.ts` | `      if (typeof def !== 'object' \|\| def === null \|\| typeof def.qual !== 'string' \|\| !isElement(def.…` → `      if (false) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition" |
| L2-T7b-M30 | a term defined again adds its definition | `src/enhance/registry.ts` | `        held.add(d); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "terms: a new name makes an entry; the same name again, in any case, adds a definition; __proto__ is a key"; "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M31 | a term defined again answers the first entry | `src/enhance/registry.ts` | `      if (held !== undefined) { ⏎         held.add(d); ⏎         return held.entry; ⏎       } ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "terms: a new name makes an entry; the same name again, in any case, adds a definition; __proto__ is a key"; "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M32 | a term's name keeps its white space runs as one space | `src/enhance/registry.ts` | `        name: squash(name),` → `        name,` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: a new name makes an entry; the same name again, in any case, adds a definition; __proto__ is a key" |
| L2-T7b-M33 | a term key is in lower case | `src/enhance/registry.ts` | `  return squash(name).toLowerCase();` → `  return squash(name);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: a new name makes an entry; the same name again, in any case, adds a definition; __proto__ is a key" |
| L2-T7b-M34 | terms.all() is in definition order | `src/enhance/registry.ts` | `      list.push(entry);` → `      list.unshift(entry);` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "terms: a new name makes an entry; the same name again, in any case, adds a definition; __proto__ is a key"; "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M35 | a table wrapper with no table is left out | `src/enhance/registry.ts` | `      if (table === null) continue; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "blocks: a table wrapper with no table, and a code block inside a figure, are left out" |
| L2-T7b-M36 | a code block inside a figure is left out | `src/enhance/registry.ts` | `    } else if (!inFigure(el, root)) {` → `    } else {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "blocks: a table wrapper with no table, and a code block inside a figure, are left out" |
| L2-T7b-M37 | a table block's heads are its header row's texts | `src/enhance/registry.ts` | `Array.from(headRow.cells).map(txt)` → `[]` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "blocks: every table and code block in document order, a figure's code left out, with their heads and rows" |
| L2-T7b-M38 | a table block's rows are its body rows | `src/enhance/registry.ts` | `rows: Object.freeze(Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[]),` → `rows: Object.freeze([]),` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "blocks: every table and code block in document order, a figure's code left out, with their heads and rows" |
| L2-T7b-M39 | the blocks list is frozen | `src/enhance/registry.ts` | `  return Object.freeze(out); ⏎ } ⏎  ⏎ /** The figures` → `  return out; ⏎ } ⏎  ⏎ /** The figures` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "blocks: every table and code block in document order, a figure's code left out, with their heads and rows" |
| L2-T7b-M40 | figures.add refuses a missing entry | `src/enhance/registry.ts` | `      if (typeof e !== 'object' \|\| e === null) throw new Error('docreader: figures.add takes an entr…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "figures: refuses a missing entry, a caption that is not text and a figure outside the root; all() sees a later add" |
| L2-T7b-M41 | a figure entry's caption is a string | `src/enhance/registry.ts` | `if (!isName(no) \|\| typeof caption !== 'string')` → `if (!isName(no))` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "figures: refuses a missing entry, a caption that is not text and a figure outside the root; all() sees a later add" |
| L2-T7b-M42 | a figure entry's figure is inside the root | `src/enhance/registry.ts` | `      if (!isElement(figure) \|\| figure === root \|\| !root.contains(figure)) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "figures: refuses a missing entry, a caption that is not text and a figure outside the root; all() sees a later add" |
| L2-T7b-M43 | one figure entry per figure | `src/enhance/registry.ts` | `      if (byFigure.has(figure)) return false; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "figures: one entry per figure element, in document order" |
| L2-T7b-M44 | figures.all() sees a later add (the cache is dropped) | `src/enhance/registry.ts` | `      byFigure.set(figure, Object.freeze({ no, caption, figure })); ⏎       sorted = null;` → `      byFigure.set(figure, Object.freeze({ no, caption, figure }));` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "figures: refuses a missing entry, a caption that is not text and a figure outside the root; all() sees a later add" |
| L2-T7b-M45 | figures.all() is in document order | `src/enhance/registry.ts` | `        const order = inOrder([...byFigure.keys()]);` → `        const order = [...byFigure.keys()];` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "figures: one entry per figure element, in document order" |
| L2-T7b-M46 | the plan is published once | `src/enhance/registry.ts` | `      if (published) throw new Error('docreader: the plan is published once'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan: empty until published, published once" |
| L2-T7b-M47 | the plan's tasks and steps are elements | `src/enhance/registry.ts` | `      if (typeof p !== 'object' \|\| p === null \|\| !elements(p.tasks) \|\| !elements(p.steps)) throw new…` → `      if (typeof p !== 'object' \|\| p === null) throw new Error('docreader: a plan has tasks and step…` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M48 | the plan's count of yours is an integer | `src/enhance/registry.ts` | `      if (!Number.isInteger(p.yours) \|\| p.yours < 0 \|\|` → `      if (p.yours < 0 \|\|` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M49 | the plan's count of yours is not negative | `src/enhance/registry.ts` | `      if (!Number.isInteger(p.yours) \|\| p.yours < 0 \|\|` → `      if (!Number.isInteger(p.yours) \|\|` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M50 | the plan's outlineable is a boolean | `src/enhance/registry.ts` | ` \|\| typeof p.outlineable !== 'boolean') throw new Error('docreader: a plan has a count` → `) throw new Error('docreader: a plan has a count` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M51 | the plan holds a frozen copy | `src/enhance/registry.ts` | `steps: Object.freeze([...p.steps]),` → `steps: p.steps,` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M52 | the page is published once | `src/enhance/registry.ts` | `      if (published) throw new Error('docreader: the page is published once'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the page: editorial publishes the byline, the waiting items and their box" |
| L2-T7b-M53 | the page has its facts and its waiting items | `src/enhance/registry.ts` | `      if (typeof p !== 'object' \|\| p === null \|\| typeof p.facts !== 'object' \|\| p.facts === null \|\| …` → `      if (typeof p !== 'object' \|\| p === null) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M54 | the page's byline and box are elements or null | `src/enhance/registry.ts` | `      if ((p.byline !== null && !isElement(p.byline)) \|\| (p.waitBox !== null && !isElement(p.waitBox…` → `      if (false) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M55 | the page holds a frozen copy of the waiting items | `src/enhance/registry.ts` | `waiting: Object.freeze([...p.waiting]), waitBox: p.waitBox });` → `waiting: p.waiting, waitBox: p.waitBox });` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the plan and the page check what they are given, and hold a frozen copy of it" |
| L2-T7b-M56 | events.on refuses an unknown name | `src/enhance/registry.ts` | `      if (!EVENT_NAMES.includes(name)) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "listeners run in order with the payload; a cancel stops one; an unknown name is refused" |
| L2-T7b-M57 | events.on takes a function | `src/enhance/registry.ts` | `      if (typeof fn !== 'function') throw new Error('docreader: events.on takes a function'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "events: on() takes a function; a listener that stops itself during an emit does not skip the next" |
| L2-T7b-M58 | an event listener's cancel stops it | `src/enhance/registry.ts` | `        if (at >= 0) list.splice(at, 1);` → `        void at;` | `test/enhance-services.test.ts`: 3 failed \| 89 passed (92). "listeners run in order with the payload; a cancel stops one; an unknown name is refused"; "events: on() takes a function; a listener that stops itself during an emit does not skip the next"; "an event listener's cancel, called twice, removes only its own listener" |
| L2-T7b-M59 | nothing is emitted once the instance is not live | `src/enhance/registry.ts` | `      if (!live()) return; ⏎       const list = [...(listeners.get(name) ?? [])];` → `      const list = [...(listeners.get(name) ?? [])];` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a listener that destroys the instance stops the rest; nothing is emitted or heard after destroy" |
| L2-T7b-M60 | an emit calls the listeners it had when it began | `src/enhance/registry.ts` | `      const list = [...(listeners.get(name) ?? [])];` → `      const list = listeners.get(name) ?? [];` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "events: on() takes a function; a listener that stops itself during an emit does not skip the next" |
| L2-T7b-M61 | a throwing listener does not stop the next | `src/enhance/registry.ts` | `          faults.push(e); ⏎         } ⏎         if (!live()) break;` → `          throw e; ⏎         } ⏎         if (!live()) break;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a throwing listener does not stop the next; the first throw is thrown again after all ran" |
| L2-T7b-M62 | a listener's throw is thrown again after all ran | `src/enhance/registry.ts` | `      if (faults.length > 0) throw faults[0]; ⏎     }, ⏎   }); ⏎ }` → `    }, ⏎   }); ⏎ }` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a throwing listener does not stop the next; the first throw is thrown again after all ran" |
| L2-T7b-M63 | the first throw is the one thrown again | `src/enhance/registry.ts` | `      if (faults.length > 0) throw faults[0]; ⏎     }, ⏎   }); ⏎ }` → `      if (faults.length > 0) throw faults[faults.length - 1]; ⏎     }, ⏎   }); ⏎ }` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a throwing listener does not stop the next; the first throw is thrown again after all ran" |
| L2-T7b-M64 | a listener that destroys the instance stops the rest | `src/enhance/registry.ts` | `        if (!live()) break; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a listener that destroys the instance stops the rest; nothing is emitted or heard after destroy" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M1",
    "guard": "index.define refuses a missing entry",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof e !== 'object' || e === null) throw new Error('docreader: index.define takes an entry');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M2",
    "guard": "an ID, a term name or a figure number is not empty",
    "file": "src/enhance/registry.ts",
    "old": "typeof v === 'string' && v !== '' && v.length <= NAME_MAX",
    "new": "typeof v === 'string' && v.length <= NAME_MAX",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M3",
    "guard": "an ID, a term name or a figure number is at most 200 code units",
    "file": "src/enhance/registry.ts",
    "old": "typeof v === 'string' && v !== '' && v.length <= NAME_MAX",
    "new": "typeof v === 'string' && v !== ''",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M4",
    "guard": "an index entry has an id",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isName(id)) throw new Error('docreader: an index entry has an id of 1 to 200 code units');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M5",
    "guard": "an index entry's kind is one of four",
    "file": "src/enhance/registry.ts",
    "old": "      if (!INDEX_KINDS.includes(kind)) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M6",
    "guard": "an index entry has a title",
    "file": "src/enhance/registry.ts",
    "old": "if (typeof title !== 'string' || typeof group !== 'string')",
    "new": "if (typeof group !== 'string')",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M7",
    "guard": "an index entry has a group",
    "file": "src/enhance/registry.ts",
    "old": "if (typeof title !== 'string' || typeof group !== 'string')",
    "new": "if (typeof title !== 'string')",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M8",
    "guard": "an index entry's status is a colour role or null",
    "file": "src/enhance/registry.ts",
    "old": "      if (status !== null && status !== 'ok' && status !== 'wait' && status !== 'no' && status !== 'info') {",
    "new": "      if (false) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M9",
    "guard": "an index entry's target is an element",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isElement(target) || target === root || !root.contains(target)",
    "new": "      if (target === root || !root.contains(target)",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M10",
    "guard": "an index entry's target is not the root",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isElement(target) || target === root || !root.contains(target)",
    "new": "      if (!isElement(target) || !root.contains(target)",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M11",
    "guard": "an index entry's target is inside the root",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isElement(target) || target === root || !root.contains(target) || target.hasAttribute(CHROME_ATTR))",
    "new": "      if (!isElement(target) || target === root || target.hasAttribute(CHROME_ATTR))",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M12",
    "guard": "an index entry's target is not chrome",
    "file": "src/enhance/registry.ts",
    "old": " || target.hasAttribute(CHROME_ATTR)) {",
    "new": ") {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M13",
    "guard": "an index entry's row is inside the root, or null",
    "file": "src/enhance/registry.ts",
    "old": "      if (row !== null && !(isElement(row) && root.contains(row))) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M14",
    "guard": "an index entry's heads are strings",
    "file": "src/enhance/registry.ts",
    "old": "      if (!Array.isArray(heads) || !heads.every((h) => typeof h === 'string')) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M15",
    "guard": "the first definition of an ID wins",
    "file": "src/enhance/registry.ts",
    "old": "      if (byId.has(id)) return false;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M16",
    "guard": "an index entry is frozen",
    "file": "src/enhance/registry.ts",
    "old": "const entry: IndexEntry = Object.freeze({ id, kind, title, status, group, target, row, heads: Object.freeze([...heads]) });",
    "new": "const entry: IndexEntry = { id, kind, title, status, group, target, row, heads: Object.freeze([...heads]) };",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M17",
    "guard": "an index entry keeps a frozen copy of the heads",
    "file": "src/enhance/registry.ts",
    "old": "heads: Object.freeze([...heads]) });",
    "new": "heads });",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M18",
    "guard": "of() keeps the first entry of a target",
    "file": "src/enhance/registry.ts",
    "old": "      if (!byEl.has(target)) byEl.set(target, entry);",
    "new": "      byEl.set(target, entry);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M19",
    "guard": "of() finds an entry by its row",
    "file": "src/enhance/registry.ts",
    "old": "      if (row !== null && !byEl.has(row)) byEl.set(row, entry);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M20",
    "guard": "all() sees a later definition (the index's cache is dropped)",
    "file": "src/enhance/registry.ts",
    "old": "      sorted = null;\n      return true;\n    },\n    get:",
    "new": "      return true;\n    },\n    get:",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M21",
    "guard": "all() is in document order",
    "file": "src/enhance/registry.ts",
    "old": "        list.sort((a, b) => (a.target === b.target ? 0 : before(a.target, b.target) ? -1 : 1));\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M22",
    "guard": "all() is frozen",
    "file": "src/enhance/registry.ts",
    "old": "        sorted = Object.freeze(list);",
    "new": "        sorted = list;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M23",
    "guard": "terms.define refuses a missing term",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof t !== 'object' || t === null) throw new Error('docreader: terms.define takes a term');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M24",
    "guard": "a term name is not blank",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isName(name) || termKey(name) === '') throw",
    "new": "      if (!isName(name)) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M25",
    "guard": "a term has a name of 1 to 200 code units",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isName(name) || termKey(name) === '') throw",
    "new": "      if (termKey(name) === '') throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M26",
    "guard": "a term's exact is a boolean",
    "file": "src/enhance/registry.ts",
    "old": "if (typeof exact !== 'boolean' || typeof section !== 'string')",
    "new": "if (typeof section !== 'string')",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M27",
    "guard": "a term's section is a string",
    "file": "src/enhance/registry.ts",
    "old": "if (typeof exact !== 'boolean' || typeof section !== 'string')",
    "new": "if (typeof exact !== 'boolean')",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M28",
    "guard": "a term's target is inside the root",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isElement(target) || !root.contains(target)) throw new Error('docreader: a term\\'s target",
    "new": "      if (false) throw new Error('docreader: a term\\'s target",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M29",
    "guard": "a term has a definition",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof def !== 'object' || def === null || typeof def.qual !== 'string' || !isElement(def.cell) || !isElement(def.row)) {",
    "new": "      if (false) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M30",
    "guard": "a term defined again adds its definition",
    "file": "src/enhance/registry.ts",
    "old": "        held.add(d);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M31",
    "guard": "a term defined again answers the first entry",
    "file": "src/enhance/registry.ts",
    "old": "      if (held !== undefined) {\n        held.add(d);\n        return held.entry;\n      }\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M32",
    "guard": "a term's name keeps its white space runs as one space",
    "file": "src/enhance/registry.ts",
    "old": "        name: squash(name),",
    "new": "        name,",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M33",
    "guard": "a term key is in lower case",
    "file": "src/enhance/registry.ts",
    "old": "  return squash(name).toLowerCase();",
    "new": "  return squash(name);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M34",
    "guard": "terms.all() is in definition order",
    "file": "src/enhance/registry.ts",
    "old": "      list.push(entry);",
    "new": "      list.unshift(entry);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M35",
    "guard": "a table wrapper with no table is left out",
    "file": "src/enhance/registry.ts",
    "old": "      if (table === null) continue;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M36",
    "guard": "a code block inside a figure is left out",
    "file": "src/enhance/registry.ts",
    "old": "    } else if (!inFigure(el, root)) {",
    "new": "    } else {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M37",
    "guard": "a table block's heads are its header row's texts",
    "file": "src/enhance/registry.ts",
    "old": "Array.from(headRow.cells).map(txt)",
    "new": "[]",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M38",
    "guard": "a table block's rows are its body rows",
    "file": "src/enhance/registry.ts",
    "old": "rows: Object.freeze(Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[]),",
    "new": "rows: Object.freeze([]),",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M39",
    "guard": "the blocks list is frozen",
    "file": "src/enhance/registry.ts",
    "old": "  return Object.freeze(out);\n}\n\n/** The figures",
    "new": "  return out;\n}\n\n/** The figures",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M40",
    "guard": "figures.add refuses a missing entry",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof e !== 'object' || e === null) throw new Error('docreader: figures.add takes an entry');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M41",
    "guard": "a figure entry's caption is a string",
    "file": "src/enhance/registry.ts",
    "old": "if (!isName(no) || typeof caption !== 'string')",
    "new": "if (!isName(no))",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M42",
    "guard": "a figure entry's figure is inside the root",
    "file": "src/enhance/registry.ts",
    "old": "      if (!isElement(figure) || figure === root || !root.contains(figure)) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M43",
    "guard": "one figure entry per figure",
    "file": "src/enhance/registry.ts",
    "old": "      if (byFigure.has(figure)) return false;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M44",
    "guard": "figures.all() sees a later add (the cache is dropped)",
    "file": "src/enhance/registry.ts",
    "old": "      byFigure.set(figure, Object.freeze({ no, caption, figure }));\n      sorted = null;",
    "new": "      byFigure.set(figure, Object.freeze({ no, caption, figure }));",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M45",
    "guard": "figures.all() is in document order",
    "file": "src/enhance/registry.ts",
    "old": "        const order = inOrder([...byFigure.keys()]);",
    "new": "        const order = [...byFigure.keys()];",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M46",
    "guard": "the plan is published once",
    "file": "src/enhance/registry.ts",
    "old": "      if (published) throw new Error('docreader: the plan is published once');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M47",
    "guard": "the plan's tasks and steps are elements",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof p !== 'object' || p === null || !elements(p.tasks) || !elements(p.steps)) throw new Error('docreader: a plan has tasks and steps');",
    "new": "      if (typeof p !== 'object' || p === null) throw new Error('docreader: a plan has tasks and steps');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M48",
    "guard": "the plan's count of yours is an integer",
    "file": "src/enhance/registry.ts",
    "old": "      if (!Number.isInteger(p.yours) || p.yours < 0 ||",
    "new": "      if (p.yours < 0 ||",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M49",
    "guard": "the plan's count of yours is not negative",
    "file": "src/enhance/registry.ts",
    "old": "      if (!Number.isInteger(p.yours) || p.yours < 0 ||",
    "new": "      if (!Number.isInteger(p.yours) ||",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M50",
    "guard": "the plan's outlineable is a boolean",
    "file": "src/enhance/registry.ts",
    "old": " || typeof p.outlineable !== 'boolean') throw new Error('docreader: a plan has a count",
    "new": ") throw new Error('docreader: a plan has a count",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M51",
    "guard": "the plan holds a frozen copy",
    "file": "src/enhance/registry.ts",
    "old": "steps: Object.freeze([...p.steps]),",
    "new": "steps: p.steps,",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M52",
    "guard": "the page is published once",
    "file": "src/enhance/registry.ts",
    "old": "      if (published) throw new Error('docreader: the page is published once');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M53",
    "guard": "the page has its facts and its waiting items",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof p !== 'object' || p === null || typeof p.facts !== 'object' || p.facts === null || !elements(p.waiting)) {",
    "new": "      if (typeof p !== 'object' || p === null) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M54",
    "guard": "the page's byline and box are elements or null",
    "file": "src/enhance/registry.ts",
    "old": "      if ((p.byline !== null && !isElement(p.byline)) || (p.waitBox !== null && !isElement(p.waitBox))) {",
    "new": "      if (false) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M55",
    "guard": "the page holds a frozen copy of the waiting items",
    "file": "src/enhance/registry.ts",
    "old": "waiting: Object.freeze([...p.waiting]), waitBox: p.waitBox });",
    "new": "waiting: p.waiting, waitBox: p.waitBox });",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M56",
    "guard": "events.on refuses an unknown name",
    "file": "src/enhance/registry.ts",
    "old": "      if (!EVENT_NAMES.includes(name)) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M57",
    "guard": "events.on takes a function",
    "file": "src/enhance/registry.ts",
    "old": "      if (typeof fn !== 'function') throw new Error('docreader: events.on takes a function');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M58",
    "guard": "an event listener's cancel stops it",
    "file": "src/enhance/registry.ts",
    "old": "        if (at >= 0) list.splice(at, 1);",
    "new": "        void at;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M59",
    "guard": "nothing is emitted once the instance is not live",
    "file": "src/enhance/registry.ts",
    "old": "      if (!live()) return;\n      const list = [...(listeners.get(name) ?? [])];",
    "new": "      const list = [...(listeners.get(name) ?? [])];",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M60",
    "guard": "an emit calls the listeners it had when it began",
    "file": "src/enhance/registry.ts",
    "old": "      const list = [...(listeners.get(name) ?? [])];",
    "new": "      const list = listeners.get(name) ?? [];",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M61",
    "guard": "a throwing listener does not stop the next",
    "file": "src/enhance/registry.ts",
    "old": "          faults.push(e);\n        }\n        if (!live()) break;",
    "new": "          throw e;\n        }\n        if (!live()) break;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M62",
    "guard": "a listener's throw is thrown again after all ran",
    "file": "src/enhance/registry.ts",
    "old": "      if (faults.length > 0) throw faults[0];\n    },\n  });\n}",
    "new": "    },\n  });\n}",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M63",
    "guard": "the first throw is the one thrown again",
    "file": "src/enhance/registry.ts",
    "old": "      if (faults.length > 0) throw faults[0];\n    },\n  });\n}",
    "new": "      if (faults.length > 0) throw faults[faults.length - 1];\n    },\n  });\n}",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M64",
    "guard": "a listener that destroys the instance stops the rest",
    "file": "src/enhance/registry.ts",
    "old": "        if (!live()) break;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## Overlays: `src/enhance/overlays.ts` (L2-T7b-M65 to L2-T7b-M74)

One registration per kind, the fixed Escape order, any() without the card, close() of an open overlay alone, and
nothing registered or closed once the instance is not live.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M65 | an overlay kind is one of seven | `src/enhance/overlays.ts` | `      if (!(OVERLAY_ORDER as readonly string[]).includes(kind)) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "any() counts every overlay but the card; close(kind) closes that one; a kind registers once" |
| L2-T7b-M66 | an overlay registers isOpen and close | `src/enhance/overlays.ts` | `      if (typeof handle !== 'object' \|\| handle === null \|\| typeof handle.isOpen !== 'function' \|\| ty…` → `      if (false) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "overlays: a handle has isOpen and close; a cancel unregisters; once destroyed nothing registers and nothing closes" |
| L2-T7b-M67 | a kind registers once | `src/enhance/overlays.ts` | `      if (handles.has(kind)) throw new Error(`docreader: the ${kind} overlay registers once`); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "any() counts every overlay but the card; close(kind) closes that one; a kind registers once" |
| L2-T7b-M68 | nothing registers once the instance is not live | `src/enhance/overlays.ts` | `      if (!live()) return () => undefined; ⏎       handles.set(kind, handle);` → `      handles.set(kind, handle);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "overlays: a handle has isOpen and close; a cancel unregisters; once destroyed nothing registers and nothing closes" |
| L2-T7b-M69 | an overlay's cancel unregisters it | `src/enhance/overlays.ts` | `        if (handles.get(kind) === handle) handles.delete(kind);` → `        void handle;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "overlays: a handle has isOpen and close; a cancel unregisters; once destroyed nothing registers and nothing closes"; "an overlay's old cancel leaves the overlay registered after it" |
| L2-T7b-M70 | Escape closes in the fixed order | `src/enhance/overlays.ts` | `    for (const kind of OVERLAY_ORDER) if (isOpen(kind)) return kind;` → `    for (const kind of [...OVERLAY_ORDER].reverse()) if (isOpen(kind)) return kind;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "Escape closes figure, keys, jump, settings, changes menu, drawer, card, one per press, in that order"; "any() counts every overlay but the card; close(kind) closes that one; a kind registers once" |
| L2-T7b-M71 | any() leaves out the card | `src/enhance/overlays.ts` | `OVERLAY_ORDER.some((kind) => kind !== 'card' && isOpen(kind))` → `OVERLAY_ORDER.some((kind) => isOpen(kind))` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "any() counts every overlay but the card; close(kind) closes that one; a kind registers once" |
| L2-T7b-M72 | nothing closes once the instance is not live | `src/enhance/overlays.ts` | `      if (!live()) return false; ⏎       const k = kind ?? top();` → `      const k = kind ?? top();` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "overlays: a handle has isOpen and close; a cancel unregisters; once destroyed nothing registers and nothing closes" |
| L2-T7b-M73 | close(kind) closes only an open overlay | `src/enhance/overlays.ts` | `      if (k === null \|\| !isOpen(k)) return false;` → `      if (k === null) return false;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "any() counts every overlay but the card; close(kind) closes that one; a kind registers once" |
| L2-T7b-M74 | close() closes the overlay | `src/enhance/overlays.ts` | `      handles.get(k)?.close(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 4 failed \| 88 passed (92). "Escape closes figure, keys, jump, settings, changes menu, drawer, card, one per press, in that order"; "any() counts every overlay but the card; close(kind) closes that one; a kind registers once"; "an open overlay stops every key but Escape, which closes it, keyboard: false or not"; "RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root's overlay" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M65",
    "guard": "an overlay kind is one of seven",
    "file": "src/enhance/overlays.ts",
    "old": "      if (!(OVERLAY_ORDER as readonly string[]).includes(kind)) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M66",
    "guard": "an overlay registers isOpen and close",
    "file": "src/enhance/overlays.ts",
    "old": "      if (typeof handle !== 'object' || handle === null || typeof handle.isOpen !== 'function' || typeof handle.close !== 'function') {",
    "new": "      if (false) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M67",
    "guard": "a kind registers once",
    "file": "src/enhance/overlays.ts",
    "old": "      if (handles.has(kind)) throw new Error(`docreader: the ${kind} overlay registers once`);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M68",
    "guard": "nothing registers once the instance is not live",
    "file": "src/enhance/overlays.ts",
    "old": "      if (!live()) return () => undefined;\n      handles.set(kind, handle);",
    "new": "      handles.set(kind, handle);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M69",
    "guard": "an overlay's cancel unregisters it",
    "file": "src/enhance/overlays.ts",
    "old": "        if (handles.get(kind) === handle) handles.delete(kind);",
    "new": "        void handle;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M70",
    "guard": "Escape closes in the fixed order",
    "file": "src/enhance/overlays.ts",
    "old": "    for (const kind of OVERLAY_ORDER) if (isOpen(kind)) return kind;",
    "new": "    for (const kind of [...OVERLAY_ORDER].reverse()) if (isOpen(kind)) return kind;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M71",
    "guard": "any() leaves out the card",
    "file": "src/enhance/overlays.ts",
    "old": "OVERLAY_ORDER.some((kind) => kind !== 'card' && isOpen(kind))",
    "new": "OVERLAY_ORDER.some((kind) => isOpen(kind))",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M72",
    "guard": "nothing closes once the instance is not live",
    "file": "src/enhance/overlays.ts",
    "old": "      if (!live()) return false;\n      const k = kind ?? top();",
    "new": "      const k = kind ?? top();",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M73",
    "guard": "close(kind) closes only an open overlay",
    "file": "src/enhance/overlays.ts",
    "old": "      if (k === null || !isOpen(k)) return false;",
    "new": "      if (k === null) return false;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M74",
    "guard": "close() closes the overlay",
    "file": "src/enhance/overlays.ts",
    "old": "      handles.get(k)?.close();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## The keyboard layer: `src/enhance/keys.ts` (L2-T7b-M75 to L2-T7b-M113)

Which root a key reaches (its target's, or on the page the sole live root: RF2), the guards on a prevented key,
modifiers, editable fields, dialogs and `keyboard: false`, Escape and the chord, the document's one listener and its
removal, bind()'s checks, and the sheet's order.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M75 | the page's html element is the page | `src/enhance/keys.ts` | `  if (n.parentNode === doc) return true; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key on the html element or on the document itself goes to the sole live root" |
| L2-T7b-M76 | the page's body is the page | `src/enhance/keys.ts` | `  return (n as Element).localName === 'body' && n.parentNode?.parentNode === doc;` → `  return false;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root's overlay"; "a root tearing down inside its own key is not live: a page key it dispatches goes to the other, sole live root" |
| L2-T7b-M77 | the document is the page | `src/enhance/keys.ts` | `  if (t === doc) return true; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key on the html element or on the document itself goes to the sole live root" |
| L2-T7b-M78 | a textarea or a select takes text | `src/enhance/keys.ts` | `/^(?:input\|textarea\|select)$/` → `/^(?:input)$/` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored" |
| L2-T7b-M79 | an editable element takes text | `src/enhance/keys.ts` | ` \|\| (el as HTMLElement).isContentEditable === true;` → `;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored" |
| L2-T7b-M80 | a key goes to the root holding its target | `src/enhance/keys.ts` | `    const holder = live.find((m) => m.root.contains(node));` → `    const holder = undefined;` | `test/enhance-services.test.ts`: 8 failed \| 84 passed (92). "Escape closes figure, keys, jump, settings, changes menu, drawer, card, one per press, in that order"; "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored"; "Ctrl or Cmd with K runs the chord, from an input too; never with Alt, nor with keyboard: false"; "an open overlay stops every key but Escape, which closes it, keyboard: false or not"; "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M81 | a page key goes to a sole live root only | `src/enhance/keys.ts` | `  return pageLevel(target, doc) && live.length === 1 ? live[0] : undefined;` → `  return pageLevel(target, doc) && live.length >= 1 ? live[0] : undefined;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root's overlay" |
| L2-T7b-M82 | only live roots take keys | `src/enhance/keys.ts` | `  const live = [...members].filter((m) => m.live());` → `  const live = [...members];` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a root tearing down inside its own key is not live: a page key it dispatches goes to the other, sole live root" |
| L2-T7b-M83 | a key whose default was prevented is left alone | `src/enhance/keys.ts` | `      if (e.defaultPrevented) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored" |
| L2-T7b-M84 | Escape closes the top overlay | `src/enhance/keys.ts` | `      overlays.close(); ⏎       return;` → `      return;` | `test/enhance-services.test.ts`: 3 failed \| 89 passed (92). "Escape closes figure, keys, jump, settings, changes menu, drawer, card, one per press, in that order"; "an open overlay stops every key but Escape, which closes it, keyboard: false or not"; "RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root's overlay" |
| L2-T7b-M85 | the chord is never with Alt | `src/enhance/keys.ts` | `    if ((e.ctrlKey \|\| e.metaKey) && !e.altKey && k.toLowerCase() === 'k') {` → `    if ((e.ctrlKey \|\| e.metaKey) && k.toLowerCase() === 'k') {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "Ctrl or Cmd with K runs the chord, from an input too; never with Alt, nor with keyboard: false" |
| L2-T7b-M86 | the chord takes K in either case | `src/enhance/keys.ts` | `&& !e.altKey && k.toLowerCase() === 'k') {` → `&& !e.altKey && k === 'k') {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "Ctrl or Cmd with K runs the chord, from an input too; never with Alt, nor with keyboard: false" |
| L2-T7b-M87 | the chord waits for keyboard: true | `src/enhance/keys.ts` | `      if (b === undefined \|\| !keyboard \|\| overlays.any()) return;` → `      if (b === undefined \|\| overlays.any()) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "Ctrl or Cmd with K runs the chord, from an input too; never with Alt, nor with keyboard: false" |
| L2-T7b-M88 | the chord waits for no dialog | `src/enhance/keys.ts` | `      if (b === undefined \|\| !keyboard \|\| overlays.any()) return;` → `      if (b === undefined \|\| !keyboard) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "an open overlay stops every key but Escape, which closes it, keyboard: false or not" |
| L2-T7b-M89 | a key waits for keyboard: true | `src/enhance/keys.ts` | `    if (!keyboard \|\| e.ctrlKey \|\| e.metaKey \|\| e.altKey) return;` → `    if (e.ctrlKey \|\| e.metaKey \|\| e.altKey) return;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored"; "an open overlay stops every key but Escape, which closes it, keyboard: false or not" |
| L2-T7b-M90 | a key with Ctrl or Cmd is ignored | `src/enhance/keys.ts` | `    if (!keyboard \|\| e.ctrlKey \|\| e.metaKey \|\| e.altKey) return;` → `    if (!keyboard \|\| e.altKey) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored" |
| L2-T7b-M91 | a key with Alt is ignored | `src/enhance/keys.ts` | `    if (!keyboard \|\| e.ctrlKey \|\| e.metaKey \|\| e.altKey) return;` → `    if (!keyboard \|\| e.ctrlKey \|\| e.metaKey) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored" |
| L2-T7b-M92 | a key in an editable field is ignored | `src/enhance/keys.ts` | `    if (editable(e.target) \|\| overlays.any()) return;` → `    if (overlays.any()) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored" |
| L2-T7b-M93 | a key waits for no dialog | `src/enhance/keys.ts` | `    if (editable(e.target) \|\| overlays.any()) return;` → `    if (editable(e.target)) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "an open overlay stops every key but Escape, which closes it, keyboard: false or not" |
| L2-T7b-M94 | a key runs only when its when() holds | `src/enhance/keys.ts` | `    if (!applies(b)) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M95 | run() returning false leaves the default | `src/enhance/keys.ts` | `    if (b.run() !== false) e.preventDefault();` → `    b.run(); ⏎     e.preventDefault();` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M96 | a binding runs inside an operation | `src/enhance/keys.ts` | `      operate(() => { ⏎         handle(e); ⏎       });` → `      handle(e);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a binding's run is an operation: a destroy it asks for waits for it; no key reaches a destroyed root" |
| L2-T7b-M97 | one keydown listener per document | `src/enhance/keys.ts` | `  let reg = docs.get(doc);` → `  let reg: { readonly members: Set<Member>; readonly listener: (e: Event) => void } \| undefined;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root's overlay"; "one keydown listener per document, removed once its last root is torn down" |
| L2-T7b-M98 | the listener stays while a root is left | `src/enhance/keys.ts` | `    if (members.size > 0) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root's overlay"; "one keydown listener per document, removed once its last root is torn down" |
| L2-T7b-M99 | the last root to go removes the listener | `src/enhance/keys.ts` | `    doc.removeEventListener('keydown', listener); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "one keydown listener per document, removed once its last root is torn down" |
| L2-T7b-M100 | the document's entry goes with its listener | `src/enhance/keys.ts` | `    if (docs?.get(doc)?.members === members) docs.delete(doc); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 10 failed \| 82 passed (92). "Escape closes figure, keys, jump, settings, changes menu, drawer, card, one per press, in that order"; "a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored"; "Ctrl or Cmd with K runs the chord, from an input too; never with Alt, nor with keyboard: false"; "an open overlay stops every key but Escape, which closes it, keyboard: false or not"; "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M101 | keys.bind refuses a missing binding | `src/enhance/keys.ts` | `      if (typeof b !== 'object' \|\| b === null) throw new Error('docreader: keys.bind takes a binding…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds" |
| L2-T7b-M102 | a binding names a key | `src/enhance/keys.ts` | `      if (typeof b.key !== 'string' \|\| b.key === '' \|\| b.key.length > KEY_MAX) throw` → `      if (typeof b.key !== 'string' \|\| b.key.length > KEY_MAX) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M103 | a key is at most 32 code units | `src/enhance/keys.ts` | `      if (typeof b.key !== 'string' \|\| b.key === '' \|\| b.key.length > KEY_MAX) throw` → `      if (typeof b.key !== 'string' \|\| b.key === '') throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds" |
| L2-T7b-M104 | a binding has a label and a run | `src/enhance/keys.ts` | `      if (typeof b.label !== 'string' \|\| typeof b.run !== 'function') throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds" |
| L2-T7b-M105 | a binding's when is a function | `src/enhance/keys.ts` | `      if (b.when !== undefined && typeof b.when !== 'function') throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds" |
| L2-T7b-M106 | a binding's listed is a boolean | `src/enhance/keys.ts` | `      if (b.listed !== undefined && typeof b.listed !== 'boolean') throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds" |
| L2-T7b-M107 | one binding per key | `src/enhance/keys.ts` | `      if (bound.has(b.key)) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M108 | nothing binds once the instance is not live | `src/enhance/keys.ts` | `      if (!live()) return () => undefined; ⏎       const held` → `      const held` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds" |
| L2-T7b-M109 | a binding's cancel unbinds it | `src/enhance/keys.ts` | `        if (bound.get(b.key) === held) bound.delete(b.key);` → `        void held;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds"; "a key binding's old cancel leaves the binding made after it" |
| L2-T7b-M110 | bindings() leaves out an unlisted key | `src/enhance/keys.ts` | `.filter((b) => b.listed !== false && applies(b));` → `.filter((b) => applies(b));` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M111 | bindings() leaves out a key that does not apply | `src/enhance/keys.ts` | `.filter((b) => b.listed !== false && applies(b));` → `.filter((b) => b.listed !== false);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M112 | bindings() is in the sheet's order | `src/enhance/keys.ts` | `      rows.sort((a, b) => rank(a.key) - rank(b.key)); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |
| L2-T7b-M113 | a key the sheet does not name comes after the others | `src/enhance/keys.ts` | `        return i < 0 ? SHEET_ORDER.length : i;` → `        return i;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet's order" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M75",
    "guard": "the page's html element is the page",
    "file": "src/enhance/keys.ts",
    "old": "  if (n.parentNode === doc) return true;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M76",
    "guard": "the page's body is the page",
    "file": "src/enhance/keys.ts",
    "old": "  return (n as Element).localName === 'body' && n.parentNode?.parentNode === doc;",
    "new": "  return false;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M77",
    "guard": "the document is the page",
    "file": "src/enhance/keys.ts",
    "old": "  if (t === doc) return true;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M78",
    "guard": "a textarea or a select takes text",
    "file": "src/enhance/keys.ts",
    "old": "/^(?:input|textarea|select)$/",
    "new": "/^(?:input)$/",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M79",
    "guard": "an editable element takes text",
    "file": "src/enhance/keys.ts",
    "old": " || (el as HTMLElement).isContentEditable === true;",
    "new": ";",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M80",
    "guard": "a key goes to the root holding its target",
    "file": "src/enhance/keys.ts",
    "old": "    const holder = live.find((m) => m.root.contains(node));",
    "new": "    const holder = undefined;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M81",
    "guard": "a page key goes to a sole live root only",
    "file": "src/enhance/keys.ts",
    "old": "  return pageLevel(target, doc) && live.length === 1 ? live[0] : undefined;",
    "new": "  return pageLevel(target, doc) && live.length >= 1 ? live[0] : undefined;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M82",
    "guard": "only live roots take keys",
    "file": "src/enhance/keys.ts",
    "old": "  const live = [...members].filter((m) => m.live());",
    "new": "  const live = [...members];",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M83",
    "guard": "a key whose default was prevented is left alone",
    "file": "src/enhance/keys.ts",
    "old": "      if (e.defaultPrevented) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M84",
    "guard": "Escape closes the top overlay",
    "file": "src/enhance/keys.ts",
    "old": "      overlays.close();\n      return;",
    "new": "      return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M85",
    "guard": "the chord is never with Alt",
    "file": "src/enhance/keys.ts",
    "old": "    if ((e.ctrlKey || e.metaKey) && !e.altKey && k.toLowerCase() === 'k') {",
    "new": "    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M86",
    "guard": "the chord takes K in either case",
    "file": "src/enhance/keys.ts",
    "old": "&& !e.altKey && k.toLowerCase() === 'k') {",
    "new": "&& !e.altKey && k === 'k') {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M87",
    "guard": "the chord waits for keyboard: true",
    "file": "src/enhance/keys.ts",
    "old": "      if (b === undefined || !keyboard || overlays.any()) return;",
    "new": "      if (b === undefined || overlays.any()) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M88",
    "guard": "the chord waits for no dialog",
    "file": "src/enhance/keys.ts",
    "old": "      if (b === undefined || !keyboard || overlays.any()) return;",
    "new": "      if (b === undefined || !keyboard) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M89",
    "guard": "a key waits for keyboard: true",
    "file": "src/enhance/keys.ts",
    "old": "    if (!keyboard || e.ctrlKey || e.metaKey || e.altKey) return;",
    "new": "    if (e.ctrlKey || e.metaKey || e.altKey) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M90",
    "guard": "a key with Ctrl or Cmd is ignored",
    "file": "src/enhance/keys.ts",
    "old": "    if (!keyboard || e.ctrlKey || e.metaKey || e.altKey) return;",
    "new": "    if (!keyboard || e.altKey) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M91",
    "guard": "a key with Alt is ignored",
    "file": "src/enhance/keys.ts",
    "old": "    if (!keyboard || e.ctrlKey || e.metaKey || e.altKey) return;",
    "new": "    if (!keyboard || e.ctrlKey || e.metaKey) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M92",
    "guard": "a key in an editable field is ignored",
    "file": "src/enhance/keys.ts",
    "old": "    if (editable(e.target) || overlays.any()) return;",
    "new": "    if (overlays.any()) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M93",
    "guard": "a key waits for no dialog",
    "file": "src/enhance/keys.ts",
    "old": "    if (editable(e.target) || overlays.any()) return;",
    "new": "    if (editable(e.target)) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M94",
    "guard": "a key runs only when its when() holds",
    "file": "src/enhance/keys.ts",
    "old": "    if (!applies(b)) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M95",
    "guard": "run() returning false leaves the default",
    "file": "src/enhance/keys.ts",
    "old": "    if (b.run() !== false) e.preventDefault();",
    "new": "    b.run();\n    e.preventDefault();",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M96",
    "guard": "a binding runs inside an operation",
    "file": "src/enhance/keys.ts",
    "old": "      operate(() => {\n        handle(e);\n      });",
    "new": "      handle(e);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M97",
    "guard": "one keydown listener per document",
    "file": "src/enhance/keys.ts",
    "old": "  let reg = docs.get(doc);",
    "new": "  let reg: { readonly members: Set<Member>; readonly listener: (e: Event) => void } | undefined;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M98",
    "guard": "the listener stays while a root is left",
    "file": "src/enhance/keys.ts",
    "old": "    if (members.size > 0) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M99",
    "guard": "the last root to go removes the listener",
    "file": "src/enhance/keys.ts",
    "old": "    doc.removeEventListener('keydown', listener);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M100",
    "guard": "the document's entry goes with its listener",
    "file": "src/enhance/keys.ts",
    "old": "    if (docs?.get(doc)?.members === members) docs.delete(doc);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M101",
    "guard": "keys.bind refuses a missing binding",
    "file": "src/enhance/keys.ts",
    "old": "      if (typeof b !== 'object' || b === null) throw new Error('docreader: keys.bind takes a binding');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M102",
    "guard": "a binding names a key",
    "file": "src/enhance/keys.ts",
    "old": "      if (typeof b.key !== 'string' || b.key === '' || b.key.length > KEY_MAX) throw",
    "new": "      if (typeof b.key !== 'string' || b.key.length > KEY_MAX) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M103",
    "guard": "a key is at most 32 code units",
    "file": "src/enhance/keys.ts",
    "old": "      if (typeof b.key !== 'string' || b.key === '' || b.key.length > KEY_MAX) throw",
    "new": "      if (typeof b.key !== 'string' || b.key === '') throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M104",
    "guard": "a binding has a label and a run",
    "file": "src/enhance/keys.ts",
    "old": "      if (typeof b.label !== 'string' || typeof b.run !== 'function') throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M105",
    "guard": "a binding's when is a function",
    "file": "src/enhance/keys.ts",
    "old": "      if (b.when !== undefined && typeof b.when !== 'function') throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M106",
    "guard": "a binding's listed is a boolean",
    "file": "src/enhance/keys.ts",
    "old": "      if (b.listed !== undefined && typeof b.listed !== 'boolean') throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M107",
    "guard": "one binding per key",
    "file": "src/enhance/keys.ts",
    "old": "      if (bound.has(b.key)) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M108",
    "guard": "nothing binds once the instance is not live",
    "file": "src/enhance/keys.ts",
    "old": "      if (!live()) return () => undefined;\n      const held",
    "new": "      const held",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M109",
    "guard": "a binding's cancel unbinds it",
    "file": "src/enhance/keys.ts",
    "old": "        if (bound.get(b.key) === held) bound.delete(b.key);",
    "new": "        void held;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M110",
    "guard": "bindings() leaves out an unlisted key",
    "file": "src/enhance/keys.ts",
    "old": ".filter((b) => b.listed !== false && applies(b));",
    "new": ".filter((b) => applies(b));",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M111",
    "guard": "bindings() leaves out a key that does not apply",
    "file": "src/enhance/keys.ts",
    "old": ".filter((b) => b.listed !== false && applies(b));",
    "new": ".filter((b) => b.listed !== false);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M112",
    "guard": "bindings() is in the sheet's order",
    "file": "src/enhance/keys.ts",
    "old": "      rows.sort((a, b) => rank(a.key) - rank(b.key));\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M113",
    "guard": "a key the sheet does not name comes after the others",
    "file": "src/enhance/keys.ts",
    "old": "        return i < 0 ? SHEET_ORDER.length : i;",
    "new": "        return i;",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## Navigation and the position seam: `src/enhance/nav.ts` (L2-T7b-M114 to L2-T7b-M145)

byId over the ids the document had, then the index (LD6), idOf, goTo (reveal, the bar's hold, scrolling, focus,
onHash, its defaults and its bounds), the delegated click (a hash link, a modified click, another link through
onLink), and the position seam.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M114 | the first element holds a repeated id | `src/enhance/nav.ts` | `    if (!ids.has(el.id)) ids.set(el.id, el);` → `    ids.set(el.id, el);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T7b-M115 | an empty id is no lookup | `src/enhance/nav.ts` | `    if (id === '') return null; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T7b-M116 | an element that left the root is no answer | `src/enhance/nav.ts` | `    if (el !== undefined && root.contains(el)) return el;` → `    if (el !== undefined) return el;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T7b-M117 | a defined ID's target that left the root is no answer | `src/enhance/nav.ts` | `    return entry !== undefined && root.contains(entry.target) ? entry.target : null;` → `    return entry !== undefined ? entry.target : null;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T7b-M118 | idOf: an id the instance did not read is no answer | `src/enhance/nav.ts` | `    if (el.id !== '' && ids.get(el.id) === el) return el.id;` → `    if (el.id !== '') return el.id;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T7b-M119 | goTo does nothing once destroyed | `src/enhance/nav.ts` | `    if (!live() \|\| !root.contains(el)) return;` → `    if (!root.contains(el)) return;` | Reported (green, guard removed): Green when measured: reveal() does nothing once the instance is not live, and the check right after it returned, so this first check was redundant. It was removed; its case, "goTo does nothing once destroyed, and stops when a revealer destroys the instance", is red under L2-T7b-M124, which deletes the check that remains. |
| L2-T7b-M120 | goTo does nothing outside the root | `src/enhance/nav.ts` | `    if (!root.contains(el)) return; ⏎     const push` → `    const push` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root" |
| L2-T7b-M121 | push defaults to true | `src/enhance/nav.ts` | `    const push = how.push ?? true;` → `    const push = how.push ?? false;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root" |
| L2-T7b-M122 | focus defaults to true | `src/enhance/nav.ts` | `    const focus = how.focus ?? true;` → `    const focus = how.focus ?? false;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root" |
| L2-T7b-M123 | goTo reveals its target | `src/enhance/nav.ts` | `    reveal(el); // does nothing once the instance is not live ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "goTo does nothing once destroyed, and stops when a revealer destroys the instance" |
| L2-T7b-M124 | goTo stops once destroyed, before or by a revealer | `src/enhance/nav.ts` | `    if (!live()) return; // destroyed before, or by a revealer (which may call the host) ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo does nothing once destroyed, and stops when a revealer destroys the instance" |
| L2-T7b-M125 | goTo holds the bar | `src/enhance/nav.ts` | `    position.holdBar(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |
| L2-T7b-M126 | a browser without scrollIntoView skips it | `src/enhance/nav.ts` | `    if (typeof target.scrollIntoView === 'function') {` → `    {` | `test/enhance-services.test.ts`: 3 failed \| 89 passed (92). "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root"; "a click under a link around the root is not the root's; an encoded id is decoded; a malformed one is no error" |
| L2-T7b-M127 | reduced motion scrolls at once | `src/enhance/nav.ts` | `behavior: env.reducedMotion() \|\| far ? 'auto' : 'smooth'` → `behavior: far ? 'auto' : 'smooth'` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo scrolls smoothly unless the reader asked for reduced motion or the target is more than two screens away" |
| L2-T7b-M128 | a target two screens away is scrolled to at once | `src/enhance/nav.ts` | `behavior: env.reducedMotion() \|\| far ? 'auto' : 'smooth'` → `behavior: env.reducedMotion() ? 'auto' : 'smooth'` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo scrolls smoothly unless the reader asked for reduced motion or the target is more than two screens away" |
| L2-T7b-M129 | goTo focuses only when asked | `src/enhance/nav.ts` | `    if (focus) {` → `    {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |
| L2-T7b-M130 | a focusable target gets no tabindex | `src/enhance/nav.ts` | `      if (!focusable(el)) journal.setAttribute(el, 'tabindex', '-1');` → `      journal.setAttribute(el, 'tabindex', '-1');` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root" |
| L2-T7b-M131 | a target with no id makes no onHash | `src/enhance/nav.ts` | `    if (id !== null) host.onHash(id, { push, from: null });` → `    host.onHash(id, { push, from: null });` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root" |
| L2-T7b-M132 | a click its own handler prevented is left alone | `src/enhance/nav.ts` | `    if (e.defaultPrevented \|\| e.button !== 0) return;` → `    if (e.button !== 0) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a click its own handler prevented is left alone; goTo after destroy does nothing" |
| L2-T7b-M133 | only the main button follows a link | `src/enhance/nav.ts` | `    if (e.defaultPrevented \|\| e.button !== 0) return;` → `    if (e.defaultPrevented) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "another link goes to onLink when the host gave one (newTab with a modifier); otherwise the browser follows it" |
| L2-T7b-M134 | a link around the root is not the root's | `src/enhance/nav.ts` | `    if (a === null \|\| !root.contains(a)) return;` → `    if (a === null) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a click under a link around the root is not the root's; an encoded id is decoded; a malformed one is no error" |
| L2-T7b-M135 | a modified click on a hash link is left to the browser | `src/enhance/nav.ts` | `      if (e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone" |
| L2-T7b-M136 | a hash link with no target is left to the browser | `src/enhance/nav.ts` | `      if (target === null) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "a click under a link around the root is not the root's; an encoded id is decoded; a malformed one is no error" |
| L2-T7b-M137 | a hash link's id is decoded | `src/enhance/nav.ts` | `    return decodeURIComponent(raw);` → `    return raw;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a click under a link around the root is not the root's; an encoded id is decoded; a malformed one is no error" |
| L2-T7b-M138 | a malformed escape is no error | `src/enhance/nav.ts` | `  try { ⏎     return decodeURIComponent(raw); ⏎   } catch { ⏎     return raw; ⏎   }` → `  return decodeURIComponent(raw);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a click under a link around the root is not the root's; an encoded id is decoded; a malformed one is no error" |
| L2-T7b-M139 | another link goes to onLink only when the host gave one | `src/enhance/nav.ts` | `    if (!host.present.has('onLink')) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "another link goes to onLink when the host gave one (newTab with a modifier); otherwise the browser follows it" |
| L2-T7b-M140 | a click with Ctrl opens a new tab | `src/enhance/nav.ts` | `    host.onLink(href, { newTab: e.ctrlKey \|\| e.metaKey \|\| e.shiftKey });` → `    host.onLink(href, { newTab: e.metaKey \|\| e.shiftKey });` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "another link goes to onLink when the host gave one (newTab with a modifier); otherwise the browser follows it" |
| L2-T7b-M141 | a click with Cmd opens a new tab | `src/enhance/nav.ts` | `    host.onLink(href, { newTab: e.ctrlKey \|\| e.metaKey \|\| e.shiftKey });` → `    host.onLink(href, { newTab: e.ctrlKey \|\| e.shiftKey });` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "another link goes to onLink when the host gave one (newTab with a modifier); otherwise the browser follows it" |
| L2-T7b-M142 | a click with Shift opens a new tab | `src/enhance/nav.ts` | `    host.onLink(href, { newTab: e.ctrlKey \|\| e.metaKey \|\| e.shiftKey });` → `    host.onLink(href, { newTab: e.ctrlKey \|\| e.metaKey });` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "another link goes to onLink when the host gave one (newTab with a modifier); otherwise the browser follows it" |
| L2-T7b-M143 | position.keep answers what fn answers | `src/enhance/nav.ts` | `    keep: <T>(fn: () => T): T => fn(),` → `    keep: <T>(fn: () => T): T => { ⏎       fn(); ⏎       return undefined as T; ⏎     },` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |
| L2-T7b-M144 | holdBar holds the bar for BAR_HOLD_MS | `src/enhance/nav.ts` | `      heldUntil = env.now() + BAR_HOLD_MS;` → `      heldUntil = env.now() + BAR_HOLD_MS / 2;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |
| L2-T7b-M145 | the hold ends at BAR_HOLD_MS | `src/enhance/nav.ts` | `    barHeld: (): boolean => env.now() < heldUntil,` → `    barHeld: (): boolean => env.now() <= heldUntil,` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M114",
    "guard": "the first element holds a repeated id",
    "file": "src/enhance/nav.ts",
    "old": "    if (!ids.has(el.id)) ids.set(el.id, el);",
    "new": "    ids.set(el.id, el);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M115",
    "guard": "an empty id is no lookup",
    "file": "src/enhance/nav.ts",
    "old": "    if (id === '') return null;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M116",
    "guard": "an element that left the root is no answer",
    "file": "src/enhance/nav.ts",
    "old": "    if (el !== undefined && root.contains(el)) return el;",
    "new": "    if (el !== undefined) return el;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M117",
    "guard": "a defined ID's target that left the root is no answer",
    "file": "src/enhance/nav.ts",
    "old": "    return entry !== undefined && root.contains(entry.target) ? entry.target : null;",
    "new": "    return entry !== undefined ? entry.target : null;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M118",
    "guard": "idOf: an id the instance did not read is no answer",
    "file": "src/enhance/nav.ts",
    "old": "    if (el.id !== '' && ids.get(el.id) === el) return el.id;",
    "new": "    if (el.id !== '') return el.id;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M120",
    "guard": "goTo does nothing outside the root",
    "file": "src/enhance/nav.ts",
    "old": "    if (!root.contains(el)) return;\n    const push",
    "new": "    const push",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M121",
    "guard": "push defaults to true",
    "file": "src/enhance/nav.ts",
    "old": "    const push = how.push ?? true;",
    "new": "    const push = how.push ?? false;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M122",
    "guard": "focus defaults to true",
    "file": "src/enhance/nav.ts",
    "old": "    const focus = how.focus ?? true;",
    "new": "    const focus = how.focus ?? false;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M123",
    "guard": "goTo reveals its target",
    "file": "src/enhance/nav.ts",
    "old": "    reveal(el); // does nothing once the instance is not live\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M124",
    "guard": "goTo stops once destroyed, before or by a revealer",
    "file": "src/enhance/nav.ts",
    "old": "    if (!live()) return; // destroyed before, or by a revealer (which may call the host)\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M125",
    "guard": "goTo holds the bar",
    "file": "src/enhance/nav.ts",
    "old": "    position.holdBar();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M126",
    "guard": "a browser without scrollIntoView skips it",
    "file": "src/enhance/nav.ts",
    "old": "    if (typeof target.scrollIntoView === 'function') {",
    "new": "    {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M127",
    "guard": "reduced motion scrolls at once",
    "file": "src/enhance/nav.ts",
    "old": "behavior: env.reducedMotion() || far ? 'auto' : 'smooth'",
    "new": "behavior: far ? 'auto' : 'smooth'",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M128",
    "guard": "a target two screens away is scrolled to at once",
    "file": "src/enhance/nav.ts",
    "old": "behavior: env.reducedMotion() || far ? 'auto' : 'smooth'",
    "new": "behavior: env.reducedMotion() ? 'auto' : 'smooth'",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M129",
    "guard": "goTo focuses only when asked",
    "file": "src/enhance/nav.ts",
    "old": "    if (focus) {",
    "new": "    {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M130",
    "guard": "a focusable target gets no tabindex",
    "file": "src/enhance/nav.ts",
    "old": "      if (!focusable(el)) journal.setAttribute(el, 'tabindex', '-1');",
    "new": "      journal.setAttribute(el, 'tabindex', '-1');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M131",
    "guard": "a target with no id makes no onHash",
    "file": "src/enhance/nav.ts",
    "old": "    if (id !== null) host.onHash(id, { push, from: null });",
    "new": "    host.onHash(id, { push, from: null });",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M132",
    "guard": "a click its own handler prevented is left alone",
    "file": "src/enhance/nav.ts",
    "old": "    if (e.defaultPrevented || e.button !== 0) return;",
    "new": "    if (e.button !== 0) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M133",
    "guard": "only the main button follows a link",
    "file": "src/enhance/nav.ts",
    "old": "    if (e.defaultPrevented || e.button !== 0) return;",
    "new": "    if (e.defaultPrevented) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M134",
    "guard": "a link around the root is not the root's",
    "file": "src/enhance/nav.ts",
    "old": "    if (a === null || !root.contains(a)) return;",
    "new": "    if (a === null) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M135",
    "guard": "a modified click on a hash link is left to the browser",
    "file": "src/enhance/nav.ts",
    "old": "      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M136",
    "guard": "a hash link with no target is left to the browser",
    "file": "src/enhance/nav.ts",
    "old": "      if (target === null) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M137",
    "guard": "a hash link's id is decoded",
    "file": "src/enhance/nav.ts",
    "old": "    return decodeURIComponent(raw);",
    "new": "    return raw;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M138",
    "guard": "a malformed escape is no error",
    "file": "src/enhance/nav.ts",
    "old": "  try {\n    return decodeURIComponent(raw);\n  } catch {\n    return raw;\n  }",
    "new": "  return decodeURIComponent(raw);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M139",
    "guard": "another link goes to onLink only when the host gave one",
    "file": "src/enhance/nav.ts",
    "old": "    if (!host.present.has('onLink')) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M140",
    "guard": "a click with Ctrl opens a new tab",
    "file": "src/enhance/nav.ts",
    "old": "    host.onLink(href, { newTab: e.ctrlKey || e.metaKey || e.shiftKey });",
    "new": "    host.onLink(href, { newTab: e.metaKey || e.shiftKey });",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M141",
    "guard": "a click with Cmd opens a new tab",
    "file": "src/enhance/nav.ts",
    "old": "    host.onLink(href, { newTab: e.ctrlKey || e.metaKey || e.shiftKey });",
    "new": "    host.onLink(href, { newTab: e.ctrlKey || e.shiftKey });",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M142",
    "guard": "a click with Shift opens a new tab",
    "file": "src/enhance/nav.ts",
    "old": "    host.onLink(href, { newTab: e.ctrlKey || e.metaKey || e.shiftKey });",
    "new": "    host.onLink(href, { newTab: e.ctrlKey || e.metaKey });",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M143",
    "guard": "position.keep answers what fn answers",
    "file": "src/enhance/nav.ts",
    "old": "    keep: <T>(fn: () => T): T => fn(),",
    "new": "    keep: <T>(fn: () => T): T => {\n      fn();\n      return undefined as T;\n    },",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M144",
    "guard": "holdBar holds the bar for BAR_HOLD_MS",
    "file": "src/enhance/nav.ts",
    "old": "      heldUntil = env.now() + BAR_HOLD_MS;",
    "new": "      heldUntil = env.now() + BAR_HOLD_MS / 2;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M145",
    "guard": "the hold ends at BAR_HOLD_MS",
    "file": "src/enhance/nav.ts",
    "old": "    barHeld: (): boolean => env.now() < heldUntil,",
    "new": "    barHeld: (): boolean => env.now() <= heldUntil,",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## Relayout: `src/enhance/relayout.ts` (L2-T7b-M146 to L2-T7b-M160)

Coalescing to one run a frame, the listeners inside position.keep, a listener's fault or destroy, the 'relayout'
event, the resize debounce, and the bounded fonts wait that asks for one run once the faces load.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M146 | requests coalesce to one run a frame | `src/enhance/relayout.ts` | `    scheduled ??= env.frame(run);` → `    scheduled = env.frame(run);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "requests in one frame run once, with every reason, then emit relayout" |
| L2-T7b-M147 | a run lets the next request schedule again | `src/enhance/relayout.ts` | `    scheduled = null; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 6 failed \| 86 passed (92). "requests in one frame run once, with every reason, then emit relayout"; "a resize is debounced: a burst is one relayout"; "a late fonts promise triggers one relayout; one that settles after destroy, none"; "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout"; "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M148 | a run takes its reasons and clears them | `src/enhance/relayout.ts` | `    pending.clear(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 5 failed \| 87 passed (92). "requests in one frame run once, with every reason, then emit relayout"; "a resize is debounced: a burst is one relayout"; "a late fonts promise triggers one relayout; one that settles after destroy, none"; "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout"; "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M149 | listeners run inside position.keep | `src/enhance/relayout.ts` | `    position.keep(() => {` → `    ((f: () => void) => f())(() => {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a run calls its listeners inside position.keep, and a fonts wait that runs out asks for none (a fake window)" |
| L2-T7b-M150 | a throwing listener stops neither the next nor the event | `src/enhance/relayout.ts` | `          faults.push(e);` → `          throw e;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a listener that throws stops neither the next nor the event, and its throw comes after; one that destroys stops the run" |
| L2-T7b-M151 | a listener's throw comes after the run | `src/enhance/relayout.ts` | `      if (thrown) throw faults[0];` → `      void thrown;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a listener that throws stops neither the next nor the event, and its throw comes after; one that destroys stops the run" |
| L2-T7b-M152 | a listener that destroys the instance stops the run | `src/enhance/relayout.ts` | `        if (!live()) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a listener that throws stops neither the next nor the event, and its throw comes after; one that destroys stops the run" |
| L2-T7b-M153 | a run emits 'relayout' | `src/enhance/relayout.ts` | `      events.emit('relayout', { reasons: Object.freeze([...reasons]) });` → `      void reasons;` | `test/enhance-services.test.ts`: 3 failed \| 89 passed (92). "requests in one frame run once, with every reason, then emit relayout"; "a run calls its listeners inside position.keep, and a fonts wait that runs out asks for none (a fake window)"; "a listener that throws stops neither the next nor the event, and its throw comes after; one that destroys stops the run" |
| L2-T7b-M154 | a resize burst is one run | `src/enhance/relayout.ts` | `    resizing?.(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a resize is debounced: a burst is one relayout" |
| L2-T7b-M155 | a resize waits RESIZE_DEBOUNCE_MS | `src/enhance/relayout.ts` | `    }, RESIZE_DEBOUNCE_MS);` → `    }, 0);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a resize is debounced: a burst is one relayout" |
| L2-T7b-M156 | fonts that loaded ask for a 'fonts' run | `src/enhance/relayout.ts` | `    if (loaded) relayout('fonts');` → `    relayout('fonts');` | `test/enhance-services.test.ts`: 3 failed \| 89 passed (92). "a run calls its listeners inside position.keep, and a fonts wait that runs out asks for none (a fake window)"; "startup asks for one relayout of its own (start)"; "the fonts wait is bounded, and a wait that runs out asks for no relayout" |
| L2-T7b-M157 | fonts that loaded ask for a run at all | `src/enhance/relayout.ts` | `    if (loaded) relayout('fonts');` → `    void loaded;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a late fonts promise triggers one relayout; one that settles after destroy, none" |
| L2-T7b-M158 | the fonts wait is bounded by FONTS_WAIT_MS | `src/enhance/relayout.ts` | `  void env.fonts(FONTS_WAIT_MS).then` → `  void env.fonts(1000).then` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the fonts wait is bounded, and a wait that runs out asks for no relayout" |
| L2-T7b-M159 | onRelayout takes a function | `src/enhance/relayout.ts` | `      if (typeof fn !== 'function') throw new Error('docreader: onRelayout takes a function'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "onRelayout takes a function, and its cancel stops it" |
| L2-T7b-M160 | onRelayout's cancel stops it | `src/enhance/relayout.ts` | `        if (at >= 0) listeners.splice(at, 1);` → `        void at;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "onRelayout takes a function, and its cancel stops it"; "a relayout listener's cancel, called twice, removes only its own listener" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M146",
    "guard": "requests coalesce to one run a frame",
    "file": "src/enhance/relayout.ts",
    "old": "    scheduled ??= env.frame(run);",
    "new": "    scheduled = env.frame(run);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M147",
    "guard": "a run lets the next request schedule again",
    "file": "src/enhance/relayout.ts",
    "old": "    scheduled = null;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M148",
    "guard": "a run takes its reasons and clears them",
    "file": "src/enhance/relayout.ts",
    "old": "    pending.clear();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M149",
    "guard": "listeners run inside position.keep",
    "file": "src/enhance/relayout.ts",
    "old": "    position.keep(() => {",
    "new": "    ((f: () => void) => f())(() => {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M150",
    "guard": "a throwing listener stops neither the next nor the event",
    "file": "src/enhance/relayout.ts",
    "old": "          faults.push(e);",
    "new": "          throw e;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M151",
    "guard": "a listener's throw comes after the run",
    "file": "src/enhance/relayout.ts",
    "old": "      if (thrown) throw faults[0];",
    "new": "      void thrown;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M152",
    "guard": "a listener that destroys the instance stops the run",
    "file": "src/enhance/relayout.ts",
    "old": "        if (!live()) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M153",
    "guard": "a run emits 'relayout'",
    "file": "src/enhance/relayout.ts",
    "old": "      events.emit('relayout', { reasons: Object.freeze([...reasons]) });",
    "new": "      void reasons;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M154",
    "guard": "a resize burst is one run",
    "file": "src/enhance/relayout.ts",
    "old": "    resizing?.();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M155",
    "guard": "a resize waits RESIZE_DEBOUNCE_MS",
    "file": "src/enhance/relayout.ts",
    "old": "    }, RESIZE_DEBOUNCE_MS);",
    "new": "    }, 0);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M156",
    "guard": "fonts that loaded ask for a 'fonts' run",
    "file": "src/enhance/relayout.ts",
    "old": "    if (loaded) relayout('fonts');",
    "new": "    relayout('fonts');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M157",
    "guard": "fonts that loaded ask for a run at all",
    "file": "src/enhance/relayout.ts",
    "old": "    if (loaded) relayout('fonts');",
    "new": "    void loaded;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M158",
    "guard": "the fonts wait is bounded by FONTS_WAIT_MS",
    "file": "src/enhance/relayout.ts",
    "old": "  void env.fonts(FONTS_WAIT_MS).then",
    "new": "  void env.fonts(1000).then",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M159",
    "guard": "onRelayout takes a function",
    "file": "src/enhance/relayout.ts",
    "old": "      if (typeof fn !== 'function') throw new Error('docreader: onRelayout takes a function');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M160",
    "guard": "onRelayout's cancel stops it",
    "file": "src/enhance/relayout.ts",
    "old": "        if (at >= 0) listeners.splice(at, 1);",
    "new": "        void at;",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## Reveal: `src/enhance/reveal.ts` (L2-T7b-M161 to L2-T7b-M171)

The closed details around a target (and none around the root), the revealers in order, a destroy in a revealer, the
'reveal' event, and what is no target.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M161 | reveal does nothing once destroyed | `src/enhance/reveal.ts` | `      if (!live() \|\| el === root \|\| !root.contains(el)) return;` → `      if (el === root \|\| !root.contains(el)) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a revealer that destroys the instance stops the rest; reveal after destroy does nothing" |
| L2-T7b-M162 | the root itself is no target | `src/enhance/reveal.ts` | `      if (!live() \|\| el === root \|\| !root.contains(el)) return;` → `      if (!live() \|\| !root.contains(el)) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next" |
| L2-T7b-M163 | an element outside the root is no target | `src/enhance/reveal.ts` | `      if (!live() \|\| el === root \|\| !root.contains(el)) return;` → `      if (!live() \|\| el === root) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next" |
| L2-T7b-M164 | reveal opens every closed details around the target | `src/enhance/reveal.ts` | `        if (n.localName === 'details' && !n.hasAttribute('open')) journal.setAttribute(n, 'open', ''…` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "opens every closed details around the target (undone by destroy), runs the revealers in order, then emits"; "reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next" |
| L2-T7b-M165 | reveal stops at the root | `src/enhance/reveal.ts` | `      for (let n: Element \| null = el; n !== null && n !== root; n = n.parentElement) {` → `      for (let n: Element \| null = el; n !== null; n = n.parentElement) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next" |
| L2-T7b-M166 | reveal runs the revealers it had when it began | `src/enhance/reveal.ts` | `      for (const fn of [...revealers]) {` → `      for (const fn of revealers) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next" |
| L2-T7b-M167 | a revealer runs | `src/enhance/reveal.ts` | `        fn(el); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 7 failed \| 85 passed (92). "opens every closed details around the target (undone by destroy), runs the revealers in order, then emits"; "a revealer that destroys the instance stops the rest; reveal after destroy does nothing"; "folds register a revealer: revealing a block of a folded section unfolds it"; "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "goTo does nothing once destroyed, and stops when a revealer destroys the instance" |
| L2-T7b-M168 | a revealer that destroys the instance stops the rest | `src/enhance/reveal.ts` | `        if (!live()) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a revealer that destroys the instance stops the rest; reveal after destroy does nothing" |
| L2-T7b-M169 | reveal emits 'reveal' | `src/enhance/reveal.ts` | `      events.emit('reveal', { target: el }); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "opens every closed details around the target (undone by destroy), runs the revealers in order, then emits" |
| L2-T7b-M170 | onReveal takes a function | `src/enhance/reveal.ts` | `      if (typeof fn !== 'function') throw new Error('docreader: onReveal takes a function'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next" |
| L2-T7b-M171 | onReveal's cancel stops it | `src/enhance/reveal.ts` | `        if (at >= 0) revealers.splice(at, 1);` → `        void at;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "opens every closed details around the target (undone by destroy), runs the revealers in order, then emits"; "a revealer's cancel, called twice, removes only its own revealer" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M161",
    "guard": "reveal does nothing once destroyed",
    "file": "src/enhance/reveal.ts",
    "old": "      if (!live() || el === root || !root.contains(el)) return;",
    "new": "      if (el === root || !root.contains(el)) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M162",
    "guard": "the root itself is no target",
    "file": "src/enhance/reveal.ts",
    "old": "      if (!live() || el === root || !root.contains(el)) return;",
    "new": "      if (!live() || !root.contains(el)) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M163",
    "guard": "an element outside the root is no target",
    "file": "src/enhance/reveal.ts",
    "old": "      if (!live() || el === root || !root.contains(el)) return;",
    "new": "      if (!live() || el === root) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M164",
    "guard": "reveal opens every closed details around the target",
    "file": "src/enhance/reveal.ts",
    "old": "        if (n.localName === 'details' && !n.hasAttribute('open')) journal.setAttribute(n, 'open', '');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M165",
    "guard": "reveal stops at the root",
    "file": "src/enhance/reveal.ts",
    "old": "      for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) {",
    "new": "      for (let n: Element | null = el; n !== null; n = n.parentElement) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M166",
    "guard": "reveal runs the revealers it had when it began",
    "file": "src/enhance/reveal.ts",
    "old": "      for (const fn of [...revealers]) {",
    "new": "      for (const fn of revealers) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M167",
    "guard": "a revealer runs",
    "file": "src/enhance/reveal.ts",
    "old": "        fn(el);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M168",
    "guard": "a revealer that destroys the instance stops the rest",
    "file": "src/enhance/reveal.ts",
    "old": "        if (!live()) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M169",
    "guard": "reveal emits 'reveal'",
    "file": "src/enhance/reveal.ts",
    "old": "      events.emit('reveal', { target: el });\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M170",
    "guard": "onReveal takes a function",
    "file": "src/enhance/reveal.ts",
    "old": "      if (typeof fn !== 'function') throw new Error('docreader: onReveal takes a function');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M171",
    "guard": "onReveal's cancel stops it",
    "file": "src/enhance/reveal.ts",
    "old": "        if (at >= 0) revealers.splice(at, 1);",
    "new": "        void at;",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## Heading controls: `src/enhance/headctl.ts` (L2-T7b-M172 to L2-T7b-M183)

Slots in a fixed order, one `.h-ctl` per heading, one control per slot, the checks on a heading, and the label of the
heading's own text.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M172 | a heading control's slot is one of three | `src/enhance/headctl.ts` | `    if (rank < 0) throw` → `    if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once" |
| L2-T7b-M173 | headCtl takes a heading | `src/enhance/headctl.ts` | `!/^h[1-6]$/.test(h.localName) \|\| ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "headCtl refuses an element that is not a heading" |
| L2-T7b-M174 | headCtl takes a heading inside the root | `src/enhance/headctl.ts` | ` \|\| !root.contains(h)) {` → `) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once" |
| L2-T7b-M175 | one .h-ctl per heading | `src/enhance/headctl.ts` | `    let rec = held.get(h);` → `    let rec: { readonly ctl: HTMLElement; readonly bySlot: Map<HeadSlot, HTMLElement> } \| undefined;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once" |
| L2-T7b-M176 | a heading gets a label of its own text | `src/enhance/headctl.ts` | `      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(…` → (deleted) | `test/enhance-services.test.ts`: 4 failed \| 88 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once"; "the label leaves out a chrome button the heading holds already (the plan's Outline button), and only that"; "a heading's label keeps its inline text as written: no space before punctuation, none for a text-less child"; "a fold's name leaves out the chrome a feature built before it put in the heading (a read mark's control)" |
| L2-T7b-M177 | a heading with a label keeps it | `src/enhance/headctl.ts` | `      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby'))` → `      if (!h.hasAttribute('aria-labelledby'))` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a heading that already has a label (aria-labelledby or aria-label) keeps it; destroy removes every control and the label" |
| L2-T7b-M178 | a heading named by another keeps it | `src/enhance/headctl.ts` | `      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby'))` → `      if (!h.hasAttribute('aria-label'))` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a heading that already has a label (aria-labelledby or aria-label) keeps it; destroy removes every control and the label" |
| L2-T7b-M179 | one control per slot | `src/enhance/headctl.ts` | `    if (rec.bySlot.has(slot)) throw` → `    if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once" |
| L2-T7b-M180 | a control goes before the next slot's | `src/enhance/headctl.ts` | `      before = rec.bySlot.get(later) ?? null;` → `      before = null;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once" |
| L2-T7b-M181 | a child the caller leaves out is left out of the heading's text (a chrome button, in the label) | `src/enhance/headctl.ts` | `    if (n.nodeType === 1 && leaveOut(n as Element)) continue; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "the label leaves out a chrome button the heading holds already (the plan's Outline button), and only that"; "a fold's name leaves out the chrome a feature built before it put in the heading (a read mark's control)" |
| L2-T7b-M182 | only a chrome button is left out of the label | `src/enhance/headctl.ts` | `const isControl = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR…` → `const isControl = (el: Element): boolean => el.localName === 'button';` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the label leaves out a chrome button the heading holds already (the plan's Outline button), and only that" |
| L2-T7b-M183 | only a button is left out of the label | `src/enhance/headctl.ts` | `const isControl = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR…` → `const isControl = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the label leaves out a chrome button the heading holds already (the plan's Outline button), and only that" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M172",
    "guard": "a heading control's slot is one of three",
    "file": "src/enhance/headctl.ts",
    "old": "    if (rank < 0) throw",
    "new": "    if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M173",
    "guard": "headCtl takes a heading",
    "file": "src/enhance/headctl.ts",
    "old": "!/^h[1-6]$/.test(h.localName) || ",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M174",
    "guard": "headCtl takes a heading inside the root",
    "file": "src/enhance/headctl.ts",
    "old": " || !root.contains(h)) {",
    "new": ") {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M175",
    "guard": "one .h-ctl per heading",
    "file": "src/enhance/headctl.ts",
    "old": "    let rec = held.get(h);",
    "new": "    let rec: { readonly ctl: HTMLElement; readonly bySlot: Map<HeadSlot, HTMLElement> } | undefined;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M176",
    "guard": "a heading gets a label of its own text",
    "file": "src/enhance/headctl.ts",
    "old": "      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', headingText(h, isControl));\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M177",
    "guard": "a heading with a label keeps it",
    "file": "src/enhance/headctl.ts",
    "old": "      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby'))",
    "new": "      if (!h.hasAttribute('aria-labelledby'))",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M178",
    "guard": "a heading named by another keeps it",
    "file": "src/enhance/headctl.ts",
    "old": "      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby'))",
    "new": "      if (!h.hasAttribute('aria-label'))",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M179",
    "guard": "one control per slot",
    "file": "src/enhance/headctl.ts",
    "old": "    if (rec.bySlot.has(slot)) throw",
    "new": "    if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M180",
    "guard": "a control goes before the next slot's",
    "file": "src/enhance/headctl.ts",
    "old": "      before = rec.bySlot.get(later) ?? null;",
    "new": "      before = null;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M181",
    "guard": "a child the caller leaves out is left out of the heading's text (a chrome button, in the label)",
    "file": "src/enhance/headctl.ts",
    "old": "    if (n.nodeType === 1 && leaveOut(n as Element)) continue;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M182",
    "guard": "only a chrome button is left out of the label",
    "file": "src/enhance/headctl.ts",
    "old": "const isControl = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR);",
    "new": "const isControl = (el: Element): boolean => el.localName === 'button';",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M183",
    "guard": "only a button is left out of the label",
    "file": "src/enhance/headctl.ts",
    "old": "const isControl = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR);",
    "new": "const isControl = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## The bar's skeleton: `src/enhance/bar.ts` (L2-T7b-M184 to L2-T7b-M191)

The skip link (only for a document; it focuses the document's first node past the skeleton and makes no hash), the
order of the skeleton's parts in the root, and the tray's fixed order of tools.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M184 | a skip link only for a document | `src/enhance/bar.ts` | `  const skip = isDocument ? chrome(doc, 'a',` → `  const skip = true ? chrome(doc, 'a',` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "none of it without chrome.bar; no skip link for what is not a document" |
| L2-T7b-M185 | the skip link makes no hash | `src/enhance/bar.ts` | `      e.preventDefault(); ⏎       let to` → `      let to` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the skip link focuses the document's first node past the skeleton (a journaled tabindex), never the root, and makes no hash" |
| L2-T7b-M186 | the skip link keeps a tabindex its target has | `src/enhance/bar.ts` | `      if (!focusable(to)) journal.setAttribute(to, 'tabindex', '-1');` → `      journal.setAttribute(to, 'tabindex', '-1');` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the skip link keeps a tabindex the first node already has; no feature's build sees the skeleton" |
| L2-T7b-M187 | the skip link focuses its target | `src/enhance/bar.ts` | `      to.focus({ preventScroll: true }); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "the skip link focuses the document's first node past the skeleton (a journaled tabindex), never the root, and makes no hash"; "the skip link keeps a tabindex the first node already has; no feature's build sees the skeleton" |
| L2-T7b-M188 | a bar tool is one of five | `src/enhance/bar.ts` | `      if (rank < 0) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "tool() keeps the tray in a fixed order (changes, outline, jump, settings, contents), whatever the call order" |
| L2-T7b-M189 | one tool per kind | `src/enhance/bar.ts` | `      if (placed.has(kind)) throw` → `      if (false) throw` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "tool() keeps the tray in a fixed order (changes, outline, jump, settings, contents), whatever the call order" |
| L2-T7b-M190 | a tool goes before the next kind's | `src/enhance/bar.ts` | `        before = placed.get(later) ?? null;` → `        before = null;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "tool() keeps the tray in a fixed order (changes, outline, jump, settings, contents), whatever the call order" |
| L2-T7b-M191 | the skeleton goes in skip link, bar, progress | `src/enhance/bar.ts` | `      journal.insert(bar, root, first); ⏎       journal.insert(progress, root, first);` → `      journal.insert(progress, root, first); ⏎       journal.insert(bar, root, first);` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "with chrome.bar (the default): a skip link, then the bar (running head, tools), then the progress, ahead of the document"; "none of it without chrome.bar; no skip link for what is not a document" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M184",
    "guard": "a skip link only for a document",
    "file": "src/enhance/bar.ts",
    "old": "  const skip = isDocument ? chrome(doc, 'a',",
    "new": "  const skip = true ? chrome(doc, 'a',",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M185",
    "guard": "the skip link makes no hash",
    "file": "src/enhance/bar.ts",
    "old": "      e.preventDefault();\n      let to",
    "new": "      let to",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M186",
    "guard": "the skip link keeps a tabindex its target has",
    "file": "src/enhance/bar.ts",
    "old": "      if (!focusable(to)) journal.setAttribute(to, 'tabindex', '-1');",
    "new": "      journal.setAttribute(to, 'tabindex', '-1');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M187",
    "guard": "the skip link focuses its target",
    "file": "src/enhance/bar.ts",
    "old": "      to.focus({ preventScroll: true });\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M188",
    "guard": "a bar tool is one of five",
    "file": "src/enhance/bar.ts",
    "old": "      if (rank < 0) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M189",
    "guard": "one tool per kind",
    "file": "src/enhance/bar.ts",
    "old": "      if (placed.has(kind)) throw",
    "new": "      if (false) throw",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M190",
    "guard": "a tool goes before the next kind's",
    "file": "src/enhance/bar.ts",
    "old": "        before = placed.get(later) ?? null;",
    "new": "        before = null;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M191",
    "guard": "the skeleton goes in skip link, bar, progress",
    "file": "src/enhance/bar.ts",
    "old": "      journal.insert(bar, root, first);\n      journal.insert(progress, root, first);",
    "new": "      journal.insert(progress, root, first);\n      journal.insert(bar, root, first);",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## Folds: heading controls, reveal, relayout and the members API (`src/enhance/folds.ts`) (L2-T7b-M192 to L2-T7b-M203)

The fold button in the heading controls, the revealer, the relayout after a change, setAll's one write, sectionOf,
join, and the API that answers the build's.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M192 | the fold button goes in the heading controls | `src/enhance/folds.ts` | `    ctx.headCtl(h, 'fold', btn);` → `    journal.insert(chrome(doc, 'span', { className: 'h-ctl' }, [btn]), h, null);` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once"; "a heading's label keeps its inline text as written: no space before punctuation, none for a text-less child" |
| L2-T7b-M193 | a fold change asks for a relayout | `src/enhance/folds.ts` | `    show(s); ⏎     ctx.relayout('folds'); ⏎   }; ⏎  ⏎   /** Fold or unfold every` → `    show(s); ⏎   }; ⏎  ⏎   /** Fold or unfold every` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout" |
| L2-T7b-M194 | setAll writes once | `src/enhance/folds.ts` | `    for (const s of changed) s.folded = on; ⏎     if (!save()) return; ⏎     for (const s of changed…` → `    for (const s of changed) setFold(s, on); ⏎     if (!ctx.live()) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout" |
| L2-T7b-M195 | setAll with nothing to change writes nothing | `src/enhance/folds.ts` | `    if (changed.length === 0) return; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "folds: setAll() with nothing to change writes nothing; join() takes a node once" |
| L2-T7b-M196 | setAll asks for one relayout | `src/enhance/folds.ts` | `    for (const s of changed) show(s); ⏎     ctx.relayout('folds');` → `    for (const s of changed) show(s);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout" |
| L2-T7b-M197 | a node's section is its root child's | `src/enhance/folds.ts` | `    while (top !== null && top.parentNode !== root) top = top.parentNode; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout" |
| L2-T7b-M198 | reveal unfolds the section that holds its target | `src/enhance/folds.ts` | `    if (s !== null) setFold(s, false);` → `    void s;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "folds register a revealer: revealing a block of a folded section unfolds it"; "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone" |
| L2-T7b-M199 | join takes a node once | `src/enhance/folds.ts` | `    if (s === undefined \|\| sectionOfMember.has(node)) return false;` → `    if (s === undefined) return false;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "folds: setAll() with nothing to change writes nothing; join() takes a node once" |
| L2-T7b-M200 | a joined node opens the fold from find-in-page | `src/enhance/folds.ts` | `        listenFind(s, node); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "join() adds a block to a member's section: hidden with the fold, shown with it, and found by find-in-page" |
| L2-T7b-M201 | a joined node is hidden with a folded section | `src/enhance/folds.ts` | `        showMember(s, node); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "join() adds a block to a member's section: hidden with the fold, shown with it, and found by find-in-page" |
| L2-T7b-M202 | a joined node folds and unfolds with its section | `src/enhance/folds.ts` | `        s.members.push(node); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "join() adds a block to a member's section: hidden with the fold, shown with it, and found by find-in-page" |
| L2-T7b-M203 | the folds' API answers the build's | `src/enhance/folds.ts` | `    impl = i;` → `    void i;` | `test/enhance-services.test.ts`: 4 failed \| 88 passed (92). "headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout"; "join() adds a block to a member's section: hidden with the fold, shown with it, and found by find-in-page"; "folds: setAll() with nothing to change writes nothing; join() takes a node once"; "folds.join takes only a node the feature put in the root: one outside it, nested, or of the document is refused" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M192",
    "guard": "the fold button goes in the heading controls",
    "file": "src/enhance/folds.ts",
    "old": "    ctx.headCtl(h, 'fold', btn);",
    "new": "    journal.insert(chrome(doc, 'span', { className: 'h-ctl' }, [btn]), h, null);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M193",
    "guard": "a fold change asks for a relayout",
    "file": "src/enhance/folds.ts",
    "old": "    show(s);\n    ctx.relayout('folds');\n  };\n\n  /** Fold or unfold every",
    "new": "    show(s);\n  };\n\n  /** Fold or unfold every",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M194",
    "guard": "setAll writes once",
    "file": "src/enhance/folds.ts",
    "old": "    for (const s of changed) s.folded = on;\n    if (!save()) return;\n    for (const s of changed) show(s);",
    "new": "    for (const s of changed) setFold(s, on);\n    if (!ctx.live()) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M195",
    "guard": "setAll with nothing to change writes nothing",
    "file": "src/enhance/folds.ts",
    "old": "    if (changed.length === 0) return;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M196",
    "guard": "setAll asks for one relayout",
    "file": "src/enhance/folds.ts",
    "old": "    for (const s of changed) show(s);\n    ctx.relayout('folds');",
    "new": "    for (const s of changed) show(s);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M197",
    "guard": "a node's section is its root child's",
    "file": "src/enhance/folds.ts",
    "old": "    while (top !== null && top.parentNode !== root) top = top.parentNode;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M198",
    "guard": "reveal unfolds the section that holds its target",
    "file": "src/enhance/folds.ts",
    "old": "    if (s !== null) setFold(s, false);",
    "new": "    void s;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M199",
    "guard": "join takes a node once",
    "file": "src/enhance/folds.ts",
    "old": "    if (s === undefined || sectionOfMember.has(node)) return false;",
    "new": "    if (s === undefined) return false;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M200",
    "guard": "a joined node opens the fold from find-in-page",
    "file": "src/enhance/folds.ts",
    "old": "        listenFind(s, node);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M201",
    "guard": "a joined node is hidden with a folded section",
    "file": "src/enhance/folds.ts",
    "old": "        showMember(s, node);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M202",
    "guard": "a joined node folds and unfolds with its section",
    "file": "src/enhance/folds.ts",
    "old": "        s.members.push(node);\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M203",
    "guard": "the folds' API answers the build's",
    "file": "src/enhance/folds.ts",
    "old": "    impl = i;",
    "new": "    void i;",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## The page and the facts seam: `src/enhance/editorial.ts` (L2-T7b-M204 to L2-T7b-M219)

`ctx.page` published by editorial, the waiting items of the first 'Waiting' box, and the facts panel's seam (take,
summary, block and what it takes).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M204 | editorial publishes the page | `src/enhance/editorial.ts` | `  ctx.page.publish({ byline: bylineEl, facts, waiting, waitBox }); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 5 failed \| 87 passed (92). "the page: editorial publishes the byline, the waiting items and their box"; "take() drops a key's dt, dd and summary part and returns its values; summary() and block() go first"; "taking every key leaves no list; destroy removes the panel and what the plugin put in it"; "the page: the first "Waiting" box alone gives the waiting items"; "the facts seam takes only new chrome, and nothing once the instance is not live" |
| L2-T7b-M205 | the page names the byline it put in | `src/enhance/editorial.ts` | `      bylineEl = byline; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the page: editorial publishes the byline, the waiting items and their box" |
| L2-T7b-M206 | the waiting items are a 'Waiting' box's | `src/enhance/editorial.ts` | `      if (c === 'waiting' && waitBox === null) {` → `      if (waitBox === null) {` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "the page: editorial publishes the byline, the waiting items and their box"; "the page: the first "Waiting" box alone gives the waiting items" |
| L2-T7b-M207 | the waiting items are the first 'Waiting' box's alone | `src/enhance/editorial.ts` | `      if (c === 'waiting' && waitBox === null) {` → `      if (c === 'waiting') {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the page: the first "Waiting" box alone gives the waiting items" |
| L2-T7b-M208 | take() answers nothing once the instance is not live | `src/enhance/editorial.ts` | `      if (k === undefined \|\| !live()) return null;` → `      if (k === undefined) return null;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the facts seam takes only new chrome, and nothing once the instance is not live" |
| L2-T7b-M209 | take() drops the key's dt | `src/enhance/editorial.ts` | `      k.dt.remove(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "take() drops a key's dt, dd and summary part and returns its values; summary() and block() go first"; "taking every key leaves no list; destroy removes the panel and what the plugin put in it" |
| L2-T7b-M210 | take() drops the key's dd | `src/enhance/editorial.ts` | `      k.dd.remove(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "take() drops a key's dt, dd and summary part and returns its values; summary() and block() go first"; "taking every key leaves no list; destroy removes the panel and what the plugin put in it" |
| L2-T7b-M211 | an empty list goes | `src/enhance/editorial.ts` | `      if (dl.children.length === 0) dl.remove(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "taking every key leaves no list; destroy removes the panel and what the plugin put in it" |
| L2-T7b-M212 | take() drops the key's summary part | `src/enhance/editorial.ts` | `      paint(); ⏎       return k.vals;` → `      return k.vals;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "taking every key leaves no list; destroy removes the panel and what the plugin put in it" |
| L2-T7b-M213 | a plugin's parts come first in the summary | `src/enhance/editorial.ts` | `    for (const part of [...plugin, ...keys.map((k) => k.part)]) {` → `    for (const part of [...keys.map((k) => k.part), ...plugin]) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "take() drops a key's dt, dd and summary part and returns its values; summary() and block() go first" |
| L2-T7b-M214 | the summary keeps a separator between parts | `src/enhance/editorial.ts` | `      if (nodes.length > 0) nodes.push(chrome(doc, 'span', { className: 'sep', text: ' · ', attrs: {…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "take() drops a key's dt, dd and summary part and returns its values; summary() and block() go first" |
| L2-T7b-M215 | a plugin's block goes before the list | `src/enhance/editorial.ts` | `      factsBody.insertBefore(node, dl.parentNode === factsBody ? dl : null);` → `      factsBody.appendChild(node);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "take() drops a key's dt, dd and summary part and returns its values; summary() and block() go first" |
| L2-T7b-M216 | the seam takes a node with no parent | `src/enhance/editorial.ts` | `    if (typeof node !== 'object' \|\| node === null \|\| node.parentNode !== null \|\| (node.nodeType === …` → `    if (typeof node !== 'object' \|\| node === null \|\| (node.nodeType === 1` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the facts seam takes only new chrome, and nothing once the instance is not live" |
| L2-T7b-M217 | the seam takes chrome elements alone | `src/enhance/editorial.ts` | ` \|\| (node.nodeType === 1 && !(node as Element).hasAttribute(CHROME_ATTR))) {` → `) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the facts seam takes only new chrome, and nothing once the instance is not live" |
| L2-T7b-M218 | summary() puts nothing once the instance is not live | `src/enhance/editorial.ts` | `      if (!live()) return false; ⏎       plugin.push(part);` → `      plugin.push(part);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the facts seam takes only new chrome, and nothing once the instance is not live" |
| L2-T7b-M219 | block() puts nothing once the instance is not live | `src/enhance/editorial.ts` | `      if (!live()) return false; ⏎       factsBody.insertBefore` → `      factsBody.insertBefore` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the facts seam takes only new chrome, and nothing once the instance is not live" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M204",
    "guard": "editorial publishes the page",
    "file": "src/enhance/editorial.ts",
    "old": "  ctx.page.publish({ byline: bylineEl, facts, waiting, waitBox });\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M205",
    "guard": "the page names the byline it put in",
    "file": "src/enhance/editorial.ts",
    "old": "      bylineEl = byline;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M206",
    "guard": "the waiting items are a 'Waiting' box's",
    "file": "src/enhance/editorial.ts",
    "old": "      if (c === 'waiting' && waitBox === null) {",
    "new": "      if (waitBox === null) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M207",
    "guard": "the waiting items are the first 'Waiting' box's alone",
    "file": "src/enhance/editorial.ts",
    "old": "      if (c === 'waiting' && waitBox === null) {",
    "new": "      if (c === 'waiting') {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M208",
    "guard": "take() answers nothing once the instance is not live",
    "file": "src/enhance/editorial.ts",
    "old": "      if (k === undefined || !live()) return null;",
    "new": "      if (k === undefined) return null;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M209",
    "guard": "take() drops the key's dt",
    "file": "src/enhance/editorial.ts",
    "old": "      k.dt.remove();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M210",
    "guard": "take() drops the key's dd",
    "file": "src/enhance/editorial.ts",
    "old": "      k.dd.remove();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M211",
    "guard": "an empty list goes",
    "file": "src/enhance/editorial.ts",
    "old": "      if (dl.children.length === 0) dl.remove();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M212",
    "guard": "take() drops the key's summary part",
    "file": "src/enhance/editorial.ts",
    "old": "      paint();\n      return k.vals;",
    "new": "      return k.vals;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M213",
    "guard": "a plugin's parts come first in the summary",
    "file": "src/enhance/editorial.ts",
    "old": "    for (const part of [...plugin, ...keys.map((k) => k.part)]) {",
    "new": "    for (const part of [...keys.map((k) => k.part), ...plugin]) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M214",
    "guard": "the summary keeps a separator between parts",
    "file": "src/enhance/editorial.ts",
    "old": "      if (nodes.length > 0) nodes.push(chrome(doc, 'span', { className: 'sep', text: ' · ', attrs: { 'aria-hidden': 'true' } }));\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M215",
    "guard": "a plugin's block goes before the list",
    "file": "src/enhance/editorial.ts",
    "old": "      factsBody.insertBefore(node, dl.parentNode === factsBody ? dl : null);",
    "new": "      factsBody.appendChild(node);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M216",
    "guard": "the seam takes a node with no parent",
    "file": "src/enhance/editorial.ts",
    "old": "    if (typeof node !== 'object' || node === null || node.parentNode !== null || (node.nodeType === 1",
    "new": "    if (typeof node !== 'object' || node === null || (node.nodeType === 1",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M217",
    "guard": "the seam takes chrome elements alone",
    "file": "src/enhance/editorial.ts",
    "old": " || (node.nodeType === 1 && !(node as Element).hasAttribute(CHROME_ATTR))) {",
    "new": ") {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M218",
    "guard": "summary() puts nothing once the instance is not live",
    "file": "src/enhance/editorial.ts",
    "old": "      if (!live()) return false;\n      plugin.push(part);",
    "new": "      plugin.push(part);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M219",
    "guard": "block() puts nothing once the instance is not live",
    "file": "src/enhance/editorial.ts",
    "old": "      if (!live()) return false;\n      factsBody.insertBefore",
    "new": "      factsBody.insertBefore",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## The lifecycle: `src/enhance/lifecycle.ts` (L2-T7b-M220 to L2-T7b-M230)

The skeleton only with `chrome.bar`, put in once every feature is built, the first relayout, and the prefs path
(ctx.setPrefs's checks, the 'prefs' event, a frozen copy, the relayout reasons).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M220 | the bar only with chrome.bar | `src/enhance/lifecycle.ts` | `  const bar = options.chrome.bar ? createBar(` → `  const bar = true ? createBar(` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "none of it without chrome.bar; no skip link for what is not a document" |
| L2-T7b-M221 | the skeleton goes in | `src/enhance/lifecycle.ts` | `  bar?.attach(); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 5 failed \| 87 passed (92). "with chrome.bar (the default): a skip link, then the bar (running head, tools), then the progress, ahead of the document"; "none of it without chrome.bar; no skip link for what is not a document"; "tool() keeps the tray in a fixed order (changes, outline, jump, settings, contents), whatever the call order"; "the skip link focuses the document's first node past the skeleton (a journaled tabindex), never the root, and makes no hash"; "the skip link keeps a tabindex the first node already has; no feature's build sees the skeleton" |
| L2-T7b-M222 | the skeleton goes in after every feature is built | `src/enhance/lifecycle.ts` | `  for (const f of list) { ⏎     f.build(ctx); ⏎     if (!live()) return; ⏎   } ⏎   // Once every fea…` → `  bar?.attach(); ⏎   for (const f of list) { ⏎     f.build(ctx); ⏎     if (!live()) return; ⏎   }` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the skip link keeps a tabindex the first node already has; no feature's build sees the skeleton" |
| L2-T7b-M223 | startup asks for the first relayout | `src/enhance/lifecycle.ts` | `  ctx.relayout('start'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "startup asks for one relayout of its own (start)"; "the fonts wait is bounded, and a wait that runs out asks for no relayout" |
| L2-T7b-M224 | ctx.setPrefs checks its prefs | `src/enhance/lifecycle.ts` | `      const checked = normalizePrefs(change);` → `      const checked = change;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M225 | the prefs event only for a change | `src/enhance/lifecycle.ts` | `  if (!changed \|\| ctx === null) return;` → `  if (ctx === null) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M226 | the prefs event carries a frozen copy | `src/enhance/lifecycle.ts` | `  ctx.events.emit('prefs', Object.freeze({ ...now }));` → `  ctx.events.emit('prefs', now);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the prefs event carries a frozen copy of the prefs" |
| L2-T7b-M227 | a width change relayouts | `src/enhance/lifecycle.ts` | `  if (now.width !== was.width \|\| now.font !== was.font) ctx.relayout('prefs');` → `  if (now.font !== was.font) ctx.relayout('prefs');` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M228 | a face change relayouts | `src/enhance/lifecycle.ts` | `  if (now.width !== was.width \|\| now.font !== was.font) ctx.relayout('prefs');` → `  if (now.width !== was.width) ctx.relayout('prefs');` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M229 | a lens change relayouts | `src/enhance/lifecycle.ts` | `  if (now.lens !== was.lens) ctx.relayout('lens'); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change" |
| L2-T7b-M230 | no prefs write once the host destroyed the instance | `src/enhance/lifecycle.ts` | `  if (inst.generation !== generation \|\| !isLive(inst)) return; ⏎   applyPrefs(inst.control.journal, …` → `  applyPrefs(inst.control.journal, inst.root, state.prefs);` | Reported (green, guard removed): Green when measured (with the lifecycle, state and services cases): once the host's set() has destroyed the instance, the journal refuses the attributes, the events emit nothing and no relayout runs, so the check (the prototype's, moved here from setEnhancementPrefs, and measured by no earlier row) was redundant. It was removed, and a comment there says why nothing follows a destroy. |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M220",
    "guard": "the bar only with chrome.bar",
    "file": "src/enhance/lifecycle.ts",
    "old": "  const bar = options.chrome.bar ? createBar(",
    "new": "  const bar = true ? createBar(",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M221",
    "guard": "the skeleton goes in",
    "file": "src/enhance/lifecycle.ts",
    "old": "  bar?.attach();\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M222",
    "guard": "the skeleton goes in after every feature is built",
    "file": "src/enhance/lifecycle.ts",
    "old": "  for (const f of list) {\n    f.build(ctx);\n    if (!live()) return;\n  }\n  // Once every feature is built: the bar's skeleton goes in, and the first measure is asked for.\n  bar?.attach();",
    "new": "  bar?.attach();\n  for (const f of list) {\n    f.build(ctx);\n    if (!live()) return;\n  }",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M223",
    "guard": "startup asks for the first relayout",
    "file": "src/enhance/lifecycle.ts",
    "old": "  ctx.relayout('start');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M224",
    "guard": "ctx.setPrefs checks its prefs",
    "file": "src/enhance/lifecycle.ts",
    "old": "      const checked = normalizePrefs(change);",
    "new": "      const checked = change;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M225",
    "guard": "the prefs event only for a change",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (!changed || ctx === null) return;",
    "new": "  if (ctx === null) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M226",
    "guard": "the prefs event carries a frozen copy",
    "file": "src/enhance/lifecycle.ts",
    "old": "  ctx.events.emit('prefs', Object.freeze({ ...now }));",
    "new": "  ctx.events.emit('prefs', now);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M227",
    "guard": "a width change relayouts",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (now.width !== was.width || now.font !== was.font) ctx.relayout('prefs');",
    "new": "  if (now.font !== was.font) ctx.relayout('prefs');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M228",
    "guard": "a face change relayouts",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (now.width !== was.width || now.font !== was.font) ctx.relayout('prefs');",
    "new": "  if (now.width !== was.width) ctx.relayout('prefs');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M229",
    "guard": "a lens change relayouts",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (now.lens !== was.lens) ctx.relayout('lens');\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## The stylesheet's markers: `assets/reader.css` (L2-T7b-M231 to L2-T7b-M233)

The three marker comments that Tasks 12, 18 and 21 insert their blocks at, each present once.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M231 | the bar's marker | `assets/reader.css` | `/* ─── marker: the bar's placement in the root (sticky, with its .scrolled and .bar-hidden states) g…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "holds each of the three markers once" |
| L2-T7b-M232 | the rail's marker | `assets/reader.css` | `/* ─── marker: the contents rail's placement in the root (a sticky column on a wide screen, a drawer…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "holds each of the three markers once" |
| L2-T7b-M233 | the figure rules' marker | `assets/reader.css` | `/* ─── marker: the drawn figure's rules (the plate, and the source while a diagram is drawn) start b…` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "holds each of the three markers once" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M231",
    "guard": "the bar's marker",
    "file": "assets/reader.css",
    "old": "/* ─── marker: the bar's placement in the root (sticky, with its .scrolled and .bar-hidden states) goes below ─── */\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M232",
    "guard": "the rail's marker",
    "file": "assets/reader.css",
    "old": "/* ─── marker: the contents rail's placement in the root (a sticky column on a wide screen, a drawer below) goes below ─── */\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M233",
    "guard": "the figure rules' marker",
    "file": "assets/reader.css",
    "old": "/* ─── marker: the drawn figure's rules (the plate, and the source while a diagram is drawn) start below ─── */\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## RF3's large plan: `test/fixtures/large-plan.ts` (L2-T7b-M234 to L2-T7b-M236)

The counts and the size the fixture's case pins, for Tasks 11, 12 and 13.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M234 | the plan has 20 steps per task | `test/fixtures/large-plan.ts` | `const STEPS_PER_TASK = 20;` → `const STEPS_PER_TASK = 19;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "holds about 1.5 MB, 2,000 IDs, 300 terms and 1,000 steps in 50 tasks, as rendered; a 2× plan doubles each" |
| L2-T7b-M235 | the plan reaches its size | `test/fixtures/large-plan.ts` | `  while (size < target) {` → `  while (size < target / 2) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "holds about 1.5 MB, 2,000 IDs, 300 terms and 1,000 steps in 50 tasks, as rendered; a 2× plan doubles each" |
| L2-T7b-M236 | every count follows the scale | `test/fixtures/large-plan.ts` | `  const terms = LARGE_PLAN_COUNTS.terms * scale;` → `  const terms = LARGE_PLAN_COUNTS.terms;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "holds about 1.5 MB, 2,000 IDs, 300 terms and 1,000 steps in 50 tasks, as rendered; a 2× plan doubles each" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M234",
    "guard": "the plan has 20 steps per task",
    "file": "test/fixtures/large-plan.ts",
    "old": "const STEPS_PER_TASK = 20;",
    "new": "const STEPS_PER_TASK = 19;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M235",
    "guard": "the plan reaches its size",
    "file": "test/fixtures/large-plan.ts",
    "old": "  while (size < target) {",
    "new": "  while (size < target / 2) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M236",
    "guard": "every count follows the scale",
    "file": "test/fixtures/large-plan.ts",
    "old": "  const terms = LARGE_PLAN_COUNTS.terms * scale;",
    "new": "  const terms = LARGE_PLAN_COUNTS.terms;",
    "tests": "test/enhance-services.test.ts"
  }
]
```

## In a real browser: the fonts relayout (L2-T7b-M237)

The fonts relayout once the faces load (C45: Chromium on the build box; CI runs WebKit too).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M237 | a 'fonts' run once the faces load, in a real browser | `src/enhance/relayout.ts` | `    if (loaded) relayout('fonts');` → `    void loaded;` | `test/browser/services.test.ts`: 2 failed \| 1 passed \| 3 skipped (6). "relayout runs once the fonts load: the start on the fallback faces, then one for the fonts, and no more"; "a stylesheet that arrives after enhance(): no fonts run on the fallback faces, then one once the faces load" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M237",
    "guard": "a 'fonts' run once the faces load, in a real browser",
    "file": "src/enhance/relayout.ts",
    "old": "    if (loaded) relayout('fonts');",
    "new": "    void loaded;",
    "tests": "test/browser/services.test.ts"
  }
]
```

## Rows of earlier tasks this task superseded (L2-T7b-M238 to L2-T7b-M241)

Task 7b rewrote code that four earlier rows name, so their `old` text no longer occurs (folds' write-behind and show,
now `save()` and `showMember()`; the context's host, now made before the context). None is dropped: each guard is
measured again here, on the code as it stands.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M238 | folds: no DOM write after the host's set() destroyed the instance (was L2P-M5) | `src/enhance/folds.ts` | `    return ctx.live(); // the host's set() ran: it may have destroyed the instance` → `    return true;` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "no write follows the destroy call, the teardown runs as the action unwinds, and destroy resolves after it with the subtree restored" |
| L2-T7b-M239 | folds: an author's own hidden block is left alone (was L2P-M17) | `src/enhance/folds.ts` | `      if (!m.hasAttribute('hidden')) {` → `      if (m.localName !== '') {` | `test/enhance-folds.test.ts`: 1 failed \| 14 passed (15). "an author's own hidden block is never touched: not on fold, not on unfold, not on destroy" |
| L2-T7b-M240 | the host's live check is the instance's (was L2-T5-M85) | `src/enhance/lifecycle.ts` | `  const host = createHost(callbacks, live, operateHere);` → `  const host = createHost(callbacks, () => true, operateHere);` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced"; "a synchronous callback that destroys the instance itself answers null, as an asynchronous one does"; "a reply after destroy is silenced on the real instance too" |
| L2-T7b-M241 | the host's operation is the instance's (was L2-T5-M86) | `src/enhance/lifecycle.ts` | `  const host = createHost(callbacks, live, operateHere);` → `  const host = createHost(callbacks, live, (fn) => fn());` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M238",
    "guard": "folds: no DOM write after the host's set() destroyed the instance (was L2P-M5)",
    "file": "src/enhance/folds.ts",
    "old": "    return ctx.live(); // the host's set() ran: it may have destroyed the instance",
    "new": "    return true;",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2-T7b-M239",
    "guard": "folds: an author's own hidden block is left alone (was L2P-M17)",
    "file": "src/enhance/folds.ts",
    "old": "      if (!m.hasAttribute('hidden')) {",
    "new": "      if (m.localName !== '') {",
    "tests": "test/enhance-folds.test.ts"
  },
  {
    "id": "L2-T7b-M240",
    "guard": "the host's live check is the instance's (was L2-T5-M85)",
    "file": "src/enhance/lifecycle.ts",
    "old": "  const host = createHost(callbacks, live, operateHere);",
    "new": "  const host = createHost(callbacks, () => true, operateHere);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T7b-M241",
    "guard": "the host's operation is the instance's (was L2-T5-M86)",
    "file": "src/enhance/lifecycle.ts",
    "old": "  const host = createHost(callbacks, live, operateHere);",
    "new": "  const host = createHost(callbacks, live, (fn) => fn());",
    "tests": "test/enhance-options.test.ts"
  }
]
```

## The review round (L2-T7b-M242 to L2-T7b-M279)

Rows for the review round's fixes and for the guards the review found unpinned: the skip link's target, scroll and
focus (one row in a real browser), the order of tools and heading controls, a heading's text as written, the folds'
names and join's refusals, the linear terms and their copies, the figure check that stops at the root, a cancel called
again or after a new registration (events, relayout, reveal, keys, overlays), ctx.setPrefs once the instance is not
live, and the fonts wait that counts only a loaded face (`src/enhance/env.ts`, Task 7a's file; the last two rows
re-measure L2-T7a-M31 and M32, whose code the fix rewrote).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7b-M242 | the skip link's target is past the skeleton (no chrome) | `src/enhance/bar.ts` | `        if (c.hasAttribute(CHROME_ATTR)) continue; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "the skip link focuses the document's first node past the skeleton (a journaled tabindex), never the root, and makes no hash"; "the skip link keeps a tabindex the first node already has; no feature's build sees the skeleton" |
| L2-T7b-M243 | the skip link never focuses the root when the document has a node, in a real browser | `src/enhance/bar.ts` | `      let to: HTMLElement = root; ⏎       for (const c of Array.from(root.children) as HTMLElement[]…` → `      const to: HTMLElement = root;` | `test/browser/services.test.ts`: 1 failed \| 2 passed \| 3 skipped (6). "the skip link skips the bar: the next Tab after it goes into the text, past every tool" |
| L2-T7b-M244 | a browser without scrollIntoView skips the skip link's scroll | `src/enhance/bar.ts` | `      if (typeof to.scrollIntoView === 'function') to.scrollIntoView` → `      to.scrollIntoView` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the skip link keeps a tabindex the first node already has; no feature's build sees the skeleton" |
| L2-T7b-M245 | the skip link scrolls its target to the start | `src/enhance/bar.ts` | `      if (typeof to.scrollIntoView === 'function') to.scrollIntoView({ block: 'start' }); ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "the skip link focuses the document's first node past the skeleton (a journaled tabindex), never the root, and makes no hash" |
| L2-T7b-M246 | a tool goes before the first later kind placed, not a later one | `src/enhance/bar.ts` | `        if (before !== null) break;` → `        void before;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "tool() keeps the tray in a fixed order (changes, outline, jump, settings, contents), whatever the call order" |
| L2-T7b-M247 | a control goes before the first later slot filled, not a later one | `src/enhance/headctl.ts` | `      if (before !== null) break;` → `      void before;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "puts each control in its slot's place, whatever the call order; labels the heading by its text once" |
| L2-T7b-M248 | a heading's text keeps its children's text as written (no space added between them) | `src/enhance/headctl.ts` | `    text += n.textContent ?? '';` → `    text += ` ${(n.textContent ?? '').trim()}`;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a heading's label keeps its inline text as written: no space before punctuation, none for a text-less child"; "a fold's name leaves out the chrome a feature built before it put in the heading (a read mark's control)" |
| L2-T7b-M249 | a heading's text is trimmed (a text-less child leaves no space) | `src/enhance/headctl.ts` | `  return text.replace(/\s+/g, ' ').trim();` → `  return text.replace(/\s+/g, ' ');` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a heading's label keeps its inline text as written: no space before punctuation, none for a text-less child" |
| L2-T7b-M250 | a heading's runs of white space are one space | `src/enhance/headctl.ts` | `  return text.replace(/\s+/g, ' ').trim();` → `  return text.trim();` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a heading's label keeps its inline text as written: no space before punctuation, none for a text-less child" |
| L2-T7b-M251 | a fold's name leaves out every chrome node in its heading | `src/enhance/folds.ts` | `const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);` → `const isChrome = (el: Element): boolean => el.localName === '';` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a fold's name leaves out the chrome a feature built before it put in the heading (a read mark's control)" |
| L2-T7b-M252 | folds.join refuses a node that is not a child of the root | `src/enhance/folds.ts` | `        if (node.parentNode !== root \|\| !node.hasAttribute(CHROME_ATTR)) {` → `        if (!node.hasAttribute(CHROME_ATTR)) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "folds.join takes only a node the feature put in the root: one outside it, nested, or of the document is refused" |
| L2-T7b-M253 | folds.join refuses a node that is not chrome (a heading or another document block) | `src/enhance/folds.ts` | `        if (node.parentNode !== root \|\| !node.hasAttribute(CHROME_ATTR)) {` → `        if (node.parentNode !== root) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "folds.join takes only a node the feature put in the root: one outside it, nested, or of the document is refused" |
| L2-T7b-M254 | a new term appends (no copy of the list per definition) | `src/enhance/registry.ts` | `      list.push(entry);` → `      list.splice(0, list.length, ...list, entry);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M255 | a new definition appends (no copy of the term's definitions per definition) | `src/enhance/registry.ts` | `          defs.push(x);` → `          defs.splice(0, defs.length, ...defs, x);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M256 | a new term makes all() answer a new copy | `src/enhance/registry.ts` | `      listCopy = null; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M257 | a new definition makes defs answer a new copy | `src/enhance/registry.ts` | `          defsCopy = null; ⏎ ` → (deleted) | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M258 | all() answers one copy until the next term | `src/enhance/registry.ts` | `    all: (): readonly TermEntry[] => (listCopy ??= Object.freeze([...list])),` → `    all: (): readonly TermEntry[] => Object.freeze([...list]),` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M259 | an entry's defs is a frozen copy | `src/enhance/registry.ts` | `          return (defsCopy ??= Object.freeze([...defs]));` → `          return defs;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "terms: defining is linear; eight times the terms, or eight times one term's definitions, takes at most 24 times as long" |
| L2-T7b-M260 | the figure check stops at the root (a host's figure is not the document's) | `src/enhance/registry.ts` | `  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) {` → `  for (let n = el.parentElement; n !== null; n = n.parentElement) {` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "blocks: a root inside a host's figure keeps its code blocks" |
| L2-T7b-M261 | an event listener's cancel, called again, removes nothing | `src/enhance/registry.ts` | `        if (at >= 0) list.splice(at, 1);` → `        list.splice(at, 1);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "an event listener's cancel, called twice, removes only its own listener" |
| L2-T7b-M262 | a relayout listener's cancel, called again, removes nothing | `src/enhance/relayout.ts` | `        if (at >= 0) listeners.splice(at, 1);` → `        listeners.splice(at, 1);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a relayout listener's cancel, called twice, removes only its own listener" |
| L2-T7b-M263 | a revealer's cancel, called again, removes nothing | `src/enhance/reveal.ts` | `        if (at >= 0) revealers.splice(at, 1);` → `        revealers.splice(at, 1);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a revealer's cancel, called twice, removes only its own revealer" |
| L2-T7b-M264 | a key binding's old cancel leaves a later binding of its key | `src/enhance/keys.ts` | `        if (bound.get(b.key) === held) bound.delete(b.key);` → `        bound.delete(b.key);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a key binding's old cancel leaves the binding made after it" |
| L2-T7b-M265 | an overlay's old cancel leaves a later registration of its kind | `src/enhance/overlays.ts` | `        if (handles.get(kind) === handle) handles.delete(kind);` → `        handles.delete(kind);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "an overlay's old cancel leaves the overlay registered after it" |
| L2-T7b-M266 | ctx.setPrefs runs inside an operation, so it does nothing once the instance is not live | `src/enhance/lifecycle.ts` | `      operate(inst, () => { ⏎         changePrefs(inst, checked); ⏎       });` → `      changePrefs(inst, checked);` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "ctx.setPrefs does nothing once the instance is not live: no state, attribute, write or event" |
| L2-T7b-M267 | the fonts wait answers true only when each face's load answered a loaded face | `src/enhance/env.ts` | `              if (found.every(loadedFace)) finish(true);` → `              if (true) finish(true);` | `test/enhance-services.test.ts`: 5 failed \| 87 passed (92). "a face no stylesheet declares yet answers no face: the wait listens for the next load and asks again"; "a wait that runs out while no face is declared answers false and leaves no listener, nor does a load that answers after it"; "an answer that is not a list of faces is no loaded face"; "destroy removes the listener of a wait; a load that answers after destroy adds none"; "a set that cannot be listened to waits for the bound" |
| L2-T7b-M268 | a loaded face has the status 'loaded' | `src/enhance/env.ts` | `(f as { status?: unknown } \| null \| undefined)?.status === 'loaded'` → `f !== undefined` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a face no stylesheet declares yet answers no face: the wait listens for the next load and asks again"; "an answer that is not a list of faces is no loaded face" |
| L2-T7b-M269 | an answer that is not a list is no loaded face | `src/enhance/env.ts` | `  return Array.isArray(found) && found.some(` → `  return found.some(` | `test/enhance-services.test.ts`: 92 passed (92); vitest reports 1 error, an unhandled rejection (TypeError: Cannot read properties of undefined (reading 'some')) |
| L2-T7b-M270 | a face's status is read through an optional chain (null or undefined in the list) | `src/enhance/env.ts` | `(f as { status?: unknown } \| null \| undefined)?.status` → `(f as { status?: unknown }).status` | `test/enhance-services.test.ts`: 92 passed (92); vitest reports 2 errors, an unhandled rejection (TypeError: Cannot read properties of undefined (reading 'status')) |
| L2-T7b-M271 | a face no stylesheet declares yet: the wait listens for the next load | `src/enhance/env.ts` | `              else hear(set);` → `              else void set;` | `test/enhance-services.test.ts`: 2 failed \| 90 passed (92). "a face no stylesheet declares yet answers no face: the wait listens for the next load and asks again"; "destroy removes the listener of a wait; a load that answers after destroy adds none" |
| L2-T7b-M272 | a wait that has ended listens no more | `src/enhance/env.ts` | `          if (settled \|\| !live()) return;` → `          if (!live()) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a wait that runs out while no face is declared answers false and leaves no listener, nor does a load that answers after it" |
| L2-T7b-M273 | a wait listens only while the instance is live | `src/enhance/env.ts` | `          if (settled \|\| !live()) return;` → `          if (settled) return;` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "destroy removes the listener of a wait; a load that answers after destroy adds none" |
| L2-T7b-M274 | the listener removes itself before it asks again | `src/enhance/env.ts` | `            unhear(); ⏎             ask();` → `            ask();` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a face no stylesheet declares yet answers no face: the wait listens for the next load and asks again" |
| L2-T7b-M275 | an ended wait removes its listener | `src/enhance/env.ts` | `          stop(); ⏎           unhear();` → `          stop();` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "a wait that runs out while no face is declared answers false and leaves no listener, nor does a load that answers after it" |
| L2-T7b-M276 | destroy removes the listener (it is tracked) | `src/enhance/env.ts` | `          unhear = track(() => { ⏎             set.removeEventListener('loadingdone', handler); ⏎   …` → `          unhear = () => { ⏎             set.removeEventListener('loadingdone', handler); ⏎         …` | `test/enhance-services.test.ts`: 1 failed \| 91 passed (92). "destroy removes the listener of a wait; a load that answers after destroy adds none" |
| L2-T7b-M277 | a font set that cannot be listened to waits out the bound | `src/enhance/env.ts` | `          try { ⏎             set.addEventListener('loadingdone', handler); ⏎           } catch { ⏎ …` → `          set.addEventListener('loadingdone', handler);` | `test/enhance-services.test.ts`: 92 passed (92); vitest reports 7 errors, an unhandled rejection (TypeError: set.addEventListener is not a function) |
| L2-T7b-M278 | a load that fails answers false (was L2-T7a-M31) | `src/enhance/env.ts` | `            () => { ⏎               finish(false); ⏎             }, ⏎           );` → `            () => { ⏎               finish(true); ⏎             }, ⏎           );` | `test/enhance-seams.test.ts`: 1 failed \| 95 passed (96). "fonts: false at once without a font set; true once the faces load; false when the wait runs out" |
| L2-T7b-M279 | a font set that cannot be read, or a load that throws at once, answers false (was L2-T7a-M32) | `src/enhance/env.ts` | `          try { ⏎             set = doc.fonts; ⏎             loads = Promise.all(FACES.map((face) =>…` → `          set = doc.fonts; ⏎           loads = Promise.all(FACES.map((face) => set.load(face)));` | `test/enhance-seams.test.ts`: 6 failed \| 90 passed (96). "destroy cancels every pending timeout, frame and idle callback with the window's own cancel"; "each schedule returns its own cancel, which cancels that one alone"; "fonts: false at once without a font set; true once the faces load; false when the wait runs out"; "fonts: false when the font set cannot be read, has no load, or a load throws at once"; "a root in a document with no window: nothing is scheduled or heard, and nothing throws" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7b-M242",
    "guard": "the skip link's target is past the skeleton (no chrome)",
    "file": "src/enhance/bar.ts",
    "old": "        if (c.hasAttribute(CHROME_ATTR)) continue;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M243",
    "guard": "the skip link never focuses the root when the document has a node, in a real browser",
    "file": "src/enhance/bar.ts",
    "old": "      let to: HTMLElement = root;\n      for (const c of Array.from(root.children) as HTMLElement[]) {\n        if (c.hasAttribute(CHROME_ATTR)) continue;\n        to = c;\n        break;\n      }",
    "new": "      const to: HTMLElement = root;",
    "tests": "test/browser/services.test.ts"
  },
  {
    "id": "L2-T7b-M244",
    "guard": "a browser without scrollIntoView skips the skip link's scroll",
    "file": "src/enhance/bar.ts",
    "old": "      if (typeof to.scrollIntoView === 'function') to.scrollIntoView",
    "new": "      to.scrollIntoView",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M245",
    "guard": "the skip link scrolls its target to the start",
    "file": "src/enhance/bar.ts",
    "old": "      if (typeof to.scrollIntoView === 'function') to.scrollIntoView({ block: 'start' });\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M246",
    "guard": "a tool goes before the first later kind placed, not a later one",
    "file": "src/enhance/bar.ts",
    "old": "        if (before !== null) break;",
    "new": "        void before;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M247",
    "guard": "a control goes before the first later slot filled, not a later one",
    "file": "src/enhance/headctl.ts",
    "old": "      if (before !== null) break;",
    "new": "      void before;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M248",
    "guard": "a heading's text keeps its children's text as written (no space added between them)",
    "file": "src/enhance/headctl.ts",
    "old": "    text += n.textContent ?? '';",
    "new": "    text += ` ${(n.textContent ?? '').trim()}`;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M249",
    "guard": "a heading's text is trimmed (a text-less child leaves no space)",
    "file": "src/enhance/headctl.ts",
    "old": "  return text.replace(/\\s+/g, ' ').trim();",
    "new": "  return text.replace(/\\s+/g, ' ');",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M250",
    "guard": "a heading's runs of white space are one space",
    "file": "src/enhance/headctl.ts",
    "old": "  return text.replace(/\\s+/g, ' ').trim();",
    "new": "  return text.trim();",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M251",
    "guard": "a fold's name leaves out every chrome node in its heading",
    "file": "src/enhance/folds.ts",
    "old": "const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);",
    "new": "const isChrome = (el: Element): boolean => el.localName === '';",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M252",
    "guard": "folds.join refuses a node that is not a child of the root",
    "file": "src/enhance/folds.ts",
    "old": "        if (node.parentNode !== root || !node.hasAttribute(CHROME_ATTR)) {",
    "new": "        if (!node.hasAttribute(CHROME_ATTR)) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M253",
    "guard": "folds.join refuses a node that is not chrome (a heading or another document block)",
    "file": "src/enhance/folds.ts",
    "old": "        if (node.parentNode !== root || !node.hasAttribute(CHROME_ATTR)) {",
    "new": "        if (node.parentNode !== root) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M254",
    "guard": "a new term appends (no copy of the list per definition)",
    "file": "src/enhance/registry.ts",
    "old": "      list.push(entry);",
    "new": "      list.splice(0, list.length, ...list, entry);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M255",
    "guard": "a new definition appends (no copy of the term's definitions per definition)",
    "file": "src/enhance/registry.ts",
    "old": "          defs.push(x);",
    "new": "          defs.splice(0, defs.length, ...defs, x);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M256",
    "guard": "a new term makes all() answer a new copy",
    "file": "src/enhance/registry.ts",
    "old": "      listCopy = null;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M257",
    "guard": "a new definition makes defs answer a new copy",
    "file": "src/enhance/registry.ts",
    "old": "          defsCopy = null;\n",
    "new": "",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M258",
    "guard": "all() answers one copy until the next term",
    "file": "src/enhance/registry.ts",
    "old": "    all: (): readonly TermEntry[] => (listCopy ??= Object.freeze([...list])),",
    "new": "    all: (): readonly TermEntry[] => Object.freeze([...list]),",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M259",
    "guard": "an entry's defs is a frozen copy",
    "file": "src/enhance/registry.ts",
    "old": "          return (defsCopy ??= Object.freeze([...defs]));",
    "new": "          return defs;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M260",
    "guard": "the figure check stops at the root (a host's figure is not the document's)",
    "file": "src/enhance/registry.ts",
    "old": "  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) {",
    "new": "  for (let n = el.parentElement; n !== null; n = n.parentElement) {",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M261",
    "guard": "an event listener's cancel, called again, removes nothing",
    "file": "src/enhance/registry.ts",
    "old": "        if (at >= 0) list.splice(at, 1);",
    "new": "        list.splice(at, 1);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M262",
    "guard": "a relayout listener's cancel, called again, removes nothing",
    "file": "src/enhance/relayout.ts",
    "old": "        if (at >= 0) listeners.splice(at, 1);",
    "new": "        listeners.splice(at, 1);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M263",
    "guard": "a revealer's cancel, called again, removes nothing",
    "file": "src/enhance/reveal.ts",
    "old": "        if (at >= 0) revealers.splice(at, 1);",
    "new": "        revealers.splice(at, 1);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M264",
    "guard": "a key binding's old cancel leaves a later binding of its key",
    "file": "src/enhance/keys.ts",
    "old": "        if (bound.get(b.key) === held) bound.delete(b.key);",
    "new": "        bound.delete(b.key);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M265",
    "guard": "an overlay's old cancel leaves a later registration of its kind",
    "file": "src/enhance/overlays.ts",
    "old": "        if (handles.get(kind) === handle) handles.delete(kind);",
    "new": "        handles.delete(kind);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M266",
    "guard": "ctx.setPrefs runs inside an operation, so it does nothing once the instance is not live",
    "file": "src/enhance/lifecycle.ts",
    "old": "      operate(inst, () => {\n        changePrefs(inst, checked);\n      });",
    "new": "      changePrefs(inst, checked);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M267",
    "guard": "the fonts wait answers true only when each face's load answered a loaded face",
    "file": "src/enhance/env.ts",
    "old": "              if (found.every(loadedFace)) finish(true);",
    "new": "              if (true) finish(true);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M268",
    "guard": "a loaded face has the status 'loaded'",
    "file": "src/enhance/env.ts",
    "old": "(f as { status?: unknown } | null | undefined)?.status === 'loaded'",
    "new": "f !== undefined",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M269",
    "guard": "an answer that is not a list is no loaded face",
    "file": "src/enhance/env.ts",
    "old": "  return Array.isArray(found) && found.some(",
    "new": "  return found.some(",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M270",
    "guard": "a face's status is read through an optional chain (null or undefined in the list)",
    "file": "src/enhance/env.ts",
    "old": "(f as { status?: unknown } | null | undefined)?.status",
    "new": "(f as { status?: unknown }).status",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M271",
    "guard": "a face no stylesheet declares yet: the wait listens for the next load",
    "file": "src/enhance/env.ts",
    "old": "              else hear(set);",
    "new": "              else void set;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M272",
    "guard": "a wait that has ended listens no more",
    "file": "src/enhance/env.ts",
    "old": "          if (settled || !live()) return;",
    "new": "          if (!live()) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M273",
    "guard": "a wait listens only while the instance is live",
    "file": "src/enhance/env.ts",
    "old": "          if (settled || !live()) return;",
    "new": "          if (settled) return;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M274",
    "guard": "the listener removes itself before it asks again",
    "file": "src/enhance/env.ts",
    "old": "            unhear();\n            ask();",
    "new": "            ask();",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M275",
    "guard": "an ended wait removes its listener",
    "file": "src/enhance/env.ts",
    "old": "          stop();\n          unhear();",
    "new": "          stop();",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M276",
    "guard": "destroy removes the listener (it is tracked)",
    "file": "src/enhance/env.ts",
    "old": "          unhear = track(() => {\n            set.removeEventListener('loadingdone', handler);\n          });",
    "new": "          unhear = () => {\n            set.removeEventListener('loadingdone', handler);\n          };",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M277",
    "guard": "a font set that cannot be listened to waits out the bound",
    "file": "src/enhance/env.ts",
    "old": "          try {\n            set.addEventListener('loadingdone', handler);\n          } catch {\n            return;\n          }",
    "new": "          set.addEventListener('loadingdone', handler);",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T7b-M278",
    "guard": "a load that fails answers false (was L2-T7a-M31)",
    "file": "src/enhance/env.ts",
    "old": "            () => {\n              finish(false);\n            },\n          );",
    "new": "            () => {\n              finish(true);\n            },\n          );",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7b-M279",
    "guard": "a font set that cannot be read, or a load that throws at once, answers false (was L2-T7a-M32)",
    "file": "src/enhance/env.ts",
    "old": "          try {\n            set = doc.fonts;\n            loads = Promise.all(FACES.map((face) => set.load(face)));\n          } catch {\n            finish(false);\n            return;\n          }",
    "new": "          set = doc.fonts;\n          loads = Promise.all(FACES.map((face) => set.load(face)));",
    "tests": "test/enhance-seams.test.ts"
  }
]
```

## Visual check

Task 7b builds nothing visible yet: the bar's skeleton is unstyled and empty until Task 12, and the skip link and the
progress line are out of the flow. Its check is that the demo is pixel-identical to the demo before it. The demo
(`scripts/demo/build.mjs`, the core sample) was built from the branch's parent, `l2-t7a-seams` at `b40be41`, before
any change of this task, and again from its final code; `scripts/visual/compare.mjs --offline` compared the two at
1440×1000 and 390×844, in light, dark and sans with wide. In each of the six combinations, 48 blocks are in both pages,
with 0 differences in any box or computed value, and the two full-page screenshots are byte-identical (the same sha256
for each pair). The Level 2 cases did not move either: their scope leaves the skeleton out, as chrome no case names.

After the review round the demo was built again, from commit `fc5c51a` (whose code is the code of the final commit;
the commits after it change tests only), and compared with the same demo of the parent: again 48 blocks in both pages
and 0 differences in each of the six combinations, and byte-identical screenshots. The round changes no style: the
skip link's target, a heading's label and the fonts wait are not visible on a page at rest.
