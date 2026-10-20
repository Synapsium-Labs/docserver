# L2 Task 11: mutation rows (plans and outline mode)

Each guard of Task 11, deleted or inverted once, with the tests that go red: task headings, their badges and owners
(`src/enhance/plans.ts`, the reference layout's section 7), steps, their numbers, owners and bodies, the outline mode
(section 23), RF3's budget on the large plan, and the rows the review asked for. Measured 2026-10-20 on branch
`l2-t11-plans`, on commit `650d043`, every row, L2-T11-M1 to L2-T11-M70 (L2-T11-M70 once more there in a stronger
form, below). All 70 are red (`rc=1`).

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), with the three changes Task 7b's rows file records: a 512 MiB
output buffer, a run that ends with no exit status reported as KILLED and counted as no verdict, and vitest's `Errors`
count line, `Unhandled Rejection` and `TypeError` lines kept in what it prints. Each row is applied to its own throwaway
copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the checkout),
its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in its file.
The rows ran with `DOCREADER_BROWSERS=chromium` (C45), in two batches side by side. The checkout was not edited while
they ran: `git status --porcelain` (empty), the hash of `git diff` and `HEAD` read the same before the batches and
after the last row. The Red column gives the count line and the failing tests the run printed (at most five here). A
count line that does not add up to its total is no verdict: none here. The count of `test/enhance-plans.test.ts`
includes its one known-failure case (`it.fails`, "1 expected fail"), which passes while the case's assertion fails;
it is the open point on folds.ts's names in the PR, and no row relies on it.

Notes on the measurement.
- Before measuring, every check that no case could redden was taken out rather than left unmeasured: checks that
  stood only for the type checker (a task's button, which now always exists in the outline mode; a strong's parent;
  the regex groups, which always match), a walk's stop at the root (no part lies outside it), and an early return in
  the outline toggle (its callers always change the state). Cases were added for the guards a first reading left
  without one: a task number that its word also holds ("Task k"), a comment that reads like a task, a chrome heading,
  an empty heading, an owner line that is a heading or opens with a space, an item the host changed (no checkbox, no
  text), a long title, a long white-space run, a nested list, a heading that already has controls, and `o` turning a
  stored outline off.
- The review found two more checks no case could redden, both since settled. The `.callout` arm of `ends()` could
  never be reached (a "Where things stand" box follows that section's h2, which has already ended every task), so it
  was taken out, and L2-T11-M5 now names the "In short" box alone. The task heading's name left out all chrome, which
  no case could tell from its plain text; it now follows headCtl's rule (only a chrome button left out), with a case
  either way (L2-T11-M64, L2-T11-M65).
- A first pass, with the RF3 case in `test/enhance-plans.test.ts`, was stopped after four rows: under a load average
  near 60 the RF3 ratio read 2.58 in an unmutated part of one run, because each size was measured in a block and the
  load changed between the blocks. The case moved to `test/enhance-plans-rf3.test.ts` and measures the two sizes run by
  run (best of four each).
- L2-T11-M26 (the split through the journal) came out green on an earlier commit: a split made outside the journal
  leaves the text in more nodes after destroy, and the destroy case compared `innerHTML`, which reads adjacent text
  nodes as one. The case now also compares the nodes one by one, and the row is red.
- L2-T11-M61 is RF3's build guard: a quadratic step added to the build (a count over the earlier steps, for each step)
  that changes no result, so only the budget and the ratio can see it. It went red through the build's ratio: about
  3.7 s on the plan twice the size against a bound of 3.0 s, 2.5 times the large plan's.
- L2-T11-M70 is RF3's toggle guard. The toggle used to be timed once, with a 5 ms floor on its ratio that every
  measured toggle (about 1 ms) fell under, so the floor was the bound. It is now timed in batches of ten, the quickest
  batch of eight per run counting, with no floor; unmutated, a toggle took about 0.6 ms on the large plan and 0.7 to
  1.0 ms on the plan twice its size (ratios 1.1 to 1.8 in four runs at a load average near 30). The first form of the
  row, one `indexOf` over the steps for each step in each show, went red by a narrow margin (2.66 ms against a bound of
  2.58 ms), so a quadratic cost of about 0.3 ms per toggle on the large plan sits near what the guard can see. The row
  recorded here searches both ways (`indexOf` and `lastIndexOf`): 13.5 ms against a bound of 8.0 ms.
- L2-T11-M7 reverts the deviation the PR names: the reference's rule, under which a box ends an h2 task only.
- L2-T11-M69 is the seams test's rule that a filled stub exports `build` only, as before Task 11 (C49 allows two
  module exports between features, neither of them plans').

## Tasks: headings, badges and owners (L2-T11-M1 to L2-T11-M21)

A task heading's grammar and its parts, the step count and the owner line, the heading's name, and the split of its text.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T11-M1 | a chrome heading is no task | `src/enhance/plans.ts` | `    if (isChrome(h)) continue; ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a chrome heading an earlier feature made is no task" |
| L2-T11-M2 | an empty heading is no task | `src/enhance/plans.ts` | `    if (t === null \|\| t.nodeType !== 3) continue;` → `    if (t.nodeType !== 3) continue;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an empty heading is no task; a task with nothing after its separator keeps an empty title" |
| L2-T11-M3 | a heading whose first child is not text is no task | `src/enhance/plans.ts` | `    if (t === null \|\| t.nodeType !== 3) continue;` → `    if (t === null) continue;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a heading whose first child is a comment that reads like a task is no task (a host's edit)" |
| L2-T11-M4 | a task ends at a heading of its level or above, not below | `src/enhance/plans.ts` | `  if (l > 0) return l <= level(h);` → `  if (l > 0) return l < level(h);` | `test/enhance-plans.test.ts`: 5 failed \| 32 passed \| 1 expected fail (38). "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader"; "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not"; "a task's parts run to the next heading of its level or above; an h2 task's stop at a box that holds an h2 too"; ""Show all" opens one task in the outline, its parts with it; turning the outline off closes every task"; "reveal opens the task that holds its target, in the outline only, and leaves the others closed" |
| L2-T11-M5 | a task ends at an "In short" box that holds such a heading | `src/enhance/plans.ts` | `  return n.matches('.short') && Array.from` → `  return false && Array.from` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a task's parts run to the next heading of its level or above; an h2 task's stop at a box that holds an h2 too" |
| L2-T11-M6 | a box ends a task only when its heading is at the task's level or above | `src/enhance/plans.ts` | `.some((x) => level(x) <= level(h));` → `.some((x) => level(x) < level(h));` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a task's parts run to the next heading of its level or above; an h2 task's stop at a box that holds an h2 too" |
| L2-T11-M7 | a box ends an h3 task too (the reference: only an h2 task) | `src/enhance/plans.ts` | `.some((x) => level(x) <= level(h));` → `.some((x) => level(x) <= 2) && level(h) === 2;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a task's parts run to the next heading of its level or above; an h2 task's stop at a box that holds an h2 too" |
| L2-T11-M8 | only task-list items count as steps | `src/enhance/plans.ts` | `if (li.classList.contains('task-list-item')) steps += 1;` → `steps += 1;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M9 | an ordered task list counts | `src/enhance/plans.ts` | `      if (n.localName === 'ul' \|\| n.localName === 'ol') {` → `      if (n.localName === 'ul') {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M10 | only the first owner line is read | `src/enhance/plans.ts` | `      if (who === '' && n.localName === 'p') {` → `      if (n.localName === 'p') {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader" |
| L2-T11-M11 | an owner line is a paragraph | `src/enhance/plans.ts` | `      if (who === '' && n.localName === 'p') {` → `      if (who === '') {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M12 | an owner line opens with its word as written | `src/enhance/plans.ts` | `        if (vocab.plan.who.test(raw)) who = ` → `        who = ` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M13 | an owner who names the reader is yours | `src/enhance/plans.ts` | `className: vocab.addressee.test(who) ? 'tmeta yours' : 'tmeta'` → `className: 'tmeta'` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader"; "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M14 | a heading with a label keeps it | `src/enhance/plans.ts` | `    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h,…` → `    journal.setAttribute(h, 'aria-label', headingText(h, isControl));` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a heading keeps a label it already has, by aria-label or aria-labelledby" |
| L2-T11-M15 | a heading labelled by another element keeps that | `src/enhance/plans.ts` | `    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h,…` → `    if (!h.hasAttribute('aria-label')) journal.setAttribute(h, 'aria-label', headingText(h, isContro…` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a heading keeps a label it already has, by aria-label or aria-labelledby" |
| L2-T11-M16 | the task number is found after its word | `src/enhance/plans.ts` | `const idEnd = text.data.indexOf(no, (m[1] as string).length) + no.length;` → `const idEnd = text.data.indexOf(no) + no.length;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an empty heading is no task; a task with nothing after its separator keeps an empty title" |
| L2-T11-M17 | a task heading splits off its title only when it has one | `src/enhance/plans.ts` | `    if (m[0].length < text.data.length) journal.split(text, m[0].length); ⏎     const sep` → `    journal.split(text, m[0].length); ⏎     const sep` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an empty heading is no task; a task with nothing after its separator keeps an empty title" |
| L2-T11-M18 | a separator is hidden | `src/enhance/plans.ts` | `  const hidden = (): HTMLSpanElement => chrome(doc, 'span', { attrs: { hidden: '' } });` → `  const hidden = (): HTMLSpanElement => chrome(doc, 'span');` | `test/enhance-plans.test.ts`: 5 failed \| 32 passed \| 1 expected fail (38). "a task heading, an h3 or an h2, in either grammar, takes its number into a badge, keeps its text and is named by it"; "an empty heading is no task; a task with nothing after its separator keeps an empty title"; "a step title's number moves into a badge before the title, its separator is hidden, and its checkbox is named"; "an owner in brackets goes into the badge; the reader's own step is marked and counted"; "what follows the title is the step's body: elements are marked, text is wrapped; a loose step marks its later blocks" |
| L2-T11-M19 | a task with no steps shows no count | `src/enhance/plans.ts` | `    if (steps > 0) journal.insert(` → `    if (true) journal.insert(` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "an empty heading is no task; a task with nothing after its separator keeps an empty title"; "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M20 | one step is "1 step" | `src/enhance/plans.ts` | `steps === 1 ? 'step' : 'steps'` → `'steps'` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader"; "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M21 | a task with no owner shows none | `src/enhance/plans.ts` | `    if (who !== '') journal.insert(` → `    if (true) journal.insert(` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader"; "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T11-M1",
    "guard": "a chrome heading is no task",
    "file": "src/enhance/plans.ts",
    "old": "    if (isChrome(h)) continue;\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M2",
    "guard": "an empty heading is no task",
    "file": "src/enhance/plans.ts",
    "old": "    if (t === null || t.nodeType !== 3) continue;",
    "new": "    if (t.nodeType !== 3) continue;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M3",
    "guard": "a heading whose first child is not text is no task",
    "file": "src/enhance/plans.ts",
    "old": "    if (t === null || t.nodeType !== 3) continue;",
    "new": "    if (t === null) continue;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M4",
    "guard": "a task ends at a heading of its level or above, not below",
    "file": "src/enhance/plans.ts",
    "old": "  if (l > 0) return l <= level(h);",
    "new": "  if (l > 0) return l < level(h);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M5",
    "guard": "a task ends at an \"In short\" box that holds such a heading",
    "file": "src/enhance/plans.ts",
    "old": "  return n.matches('.short') && Array.from",
    "new": "  return false && Array.from",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M6",
    "guard": "a box ends a task only when its heading is at the task's level or above",
    "file": "src/enhance/plans.ts",
    "old": ".some((x) => level(x) <= level(h));",
    "new": ".some((x) => level(x) < level(h));",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M7",
    "guard": "a box ends an h3 task too (the reference: only an h2 task)",
    "file": "src/enhance/plans.ts",
    "old": ".some((x) => level(x) <= level(h));",
    "new": ".some((x) => level(x) <= 2) && level(h) === 2;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M8",
    "guard": "only task-list items count as steps",
    "file": "src/enhance/plans.ts",
    "old": "if (li.classList.contains('task-list-item')) steps += 1;",
    "new": "steps += 1;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M9",
    "guard": "an ordered task list counts",
    "file": "src/enhance/plans.ts",
    "old": "      if (n.localName === 'ul' || n.localName === 'ol') {",
    "new": "      if (n.localName === 'ul') {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M10",
    "guard": "only the first owner line is read",
    "file": "src/enhance/plans.ts",
    "old": "      if (who === '' && n.localName === 'p') {",
    "new": "      if (n.localName === 'p') {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M11",
    "guard": "an owner line is a paragraph",
    "file": "src/enhance/plans.ts",
    "old": "      if (who === '' && n.localName === 'p') {",
    "new": "      if (who === '') {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M12",
    "guard": "an owner line opens with its word as written",
    "file": "src/enhance/plans.ts",
    "old": "        if (vocab.plan.who.test(raw)) who = ",
    "new": "        who = ",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M13",
    "guard": "an owner who names the reader is yours",
    "file": "src/enhance/plans.ts",
    "old": "className: vocab.addressee.test(who) ? 'tmeta yours' : 'tmeta'",
    "new": "className: 'tmeta'",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M14",
    "guard": "a heading with a label keeps it",
    "file": "src/enhance/plans.ts",
    "old": "    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', headingText(h, isControl));",
    "new": "    journal.setAttribute(h, 'aria-label', headingText(h, isControl));",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M15",
    "guard": "a heading labelled by another element keeps that",
    "file": "src/enhance/plans.ts",
    "old": "    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', headingText(h, isControl));",
    "new": "    if (!h.hasAttribute('aria-label')) journal.setAttribute(h, 'aria-label', headingText(h, isControl));",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M16",
    "guard": "the task number is found after its word",
    "file": "src/enhance/plans.ts",
    "old": "const idEnd = text.data.indexOf(no, (m[1] as string).length) + no.length;",
    "new": "const idEnd = text.data.indexOf(no) + no.length;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M17",
    "guard": "a task heading splits off its title only when it has one",
    "file": "src/enhance/plans.ts",
    "old": "    if (m[0].length < text.data.length) journal.split(text, m[0].length);\n    const sep",
    "new": "    journal.split(text, m[0].length);\n    const sep",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M18",
    "guard": "a separator is hidden",
    "file": "src/enhance/plans.ts",
    "old": "  const hidden = (): HTMLSpanElement => chrome(doc, 'span', { attrs: { hidden: '' } });",
    "new": "  const hidden = (): HTMLSpanElement => chrome(doc, 'span');",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M19",
    "guard": "a task with no steps shows no count",
    "file": "src/enhance/plans.ts",
    "old": "    if (steps > 0) journal.insert(",
    "new": "    if (true) journal.insert(",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M20",
    "guard": "one step is \"1 step\"",
    "file": "src/enhance/plans.ts",
    "old": "steps === 1 ? 'step' : 'steps'",
    "new": "'steps'",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M21",
    "guard": "a task with no owner shows none",
    "file": "src/enhance/plans.ts",
    "old": "    if (who !== '') journal.insert(",
    "new": "    if (true) journal.insert(",
    "tests": "test/enhance-plans.test.ts"
  }
]
```

## Steps: numbers, owners and bodies (L2-T11-M22 to L2-T11-M38)

A step title's number and owner, the reader's own steps, the body, a loose item, and the checkbox's name; the split and the move through the journal.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T11-M22 | a loose item's title is in its first paragraph | `src/enhance/plans.ts` | ` ?? cb?.parentElement?.querySelector(':scope > strong') ?? null;` → ` ?? null;` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "an owner in brackets goes into the badge; the reader's own step is marked and counted"; "what follows the title is the step's body: elements are marked, text is wrapped; a loose step marks its later blocks" |
| L2-T11-M23 | a title whose first child is not text is no title | `src/enhance/plans.ts` | `    if (first !== null && first.nodeType === 3) {` → `    if (first !== null) {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a title whose first child is not text is no title, and the rest of its item is left as written" |
| L2-T11-M24 | an item with no bold text has no title | `src/enhance/plans.ts` | `    if (first !== null && first.nodeType === 3) {` → `    if (first.nodeType === 3) {` | `test/enhance-plans.test.ts`: 27 failed \| 10 passed \| 1 expected fail (38). "a task heading, an h3 or an h2, in either grammar, takes its number into a badge, keeps its text and is named by it"; "a task heading is named as headCtl names a heading: a chrome button left out, text in other chrome kept"; "a heading keeps a label it already has, by aria-label or aria-labelledby"; "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader"; "a step title's number moves into a badge before the title, its separator is hidden, and its checkbox is named" |
| L2-T11-M25 | a step title splits off its title only when it has one | `src/enhance/plans.ts` | `        if (m[0].length < text.data.length) journal.split(text, m[0].length); ⏎         const after` → `        journal.split(text, m[0].length); ⏎         const after` | `test/enhance-plans.test.ts`: 25 failed \| 12 passed \| 1 expected fail (38). "a task heading, an h3 or an h2, in either grammar, takes its number into a badge, keeps its text and is named by it"; "a task heading is named as headCtl names a heading: a chrome button left out, text in other chrome kept"; "a heading keeps a label it already has, by aria-label or aria-labelledby"; "the badge counts the task's steps and names the owner its first owner line gives; "yours" when that names the reader"; "a step title's number moves into a badge before the title, its separator is hidden, and its checkbox is named" |
| L2-T11-M26 | the split goes through the journal | `src/enhance/plans.ts` | `        const after = journal.split(text, title.length);` → `        const after = text.splitText(title.length);` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "destroy restores the document byte for byte, after the outline was used, and every text node is one again" |
| L2-T11-M27 | the move goes through the journal | `src/enhance/plans.ts` | `        journal.move(text, badge, null);` → `        badge.appendChild(text);` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "destroy restores the document byte for byte, after the outline was used, and every text node is one again"; "a destroy from the host's set() while the outline changes: nothing is written after it, and the root is restored" |
| L2-T11-M28 | an owner anywhere in the bracket names the reader ("yours") | `src/enhance/plans.ts` | `          if (vocab.addresseeAnywhere.test(owner)) {` → `          if (vocab.addressee.test(owner)) {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an owner in brackets goes into the badge; the reader's own step is marked and counted" |
| L2-T11-M29 | a titled step with no checkbox names none | `src/enhance/plans.ts` | `        if (cb !== null) journal.setAttribute(cb, 'aria-label', `${title}` → `        journal.setAttribute(cb, 'aria-label', `${title}` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an item the host changed: no checkbox, or no text, is still built without a throw" |
| L2-T11-M30 | a checkbox name is cut to 90 characters | `src/enhance/plans.ts` | `const STEP_LABEL_MAX = 90;` → `const STEP_LABEL_MAX = 900;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a checkbox's name is cut to 90 characters, and an item's text is read to 300 for it" |
| L2-T11-M31 | an item's text is read to 300 characters | `src/enhance/plans.ts` | `const ITEM_TEXT_MAX = 300;` → `const ITEM_TEXT_MAX = 3000;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a checkbox's name is cut to 90 characters, and an item's text is read to 300 for it" |
| L2-T11-M32 | only what follows the title is the body | `src/enhance/plans.ts` | `        if (!past) continue; ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 3 failed \| 34 passed \| 1 expected fail (38). "a step title's number moves into a badge before the title, its separator is hidden, and its checkbox is named"; "what follows the title is the step's body: elements are marked, text is wrapped; a loose step marks its later blocks"; "an item with no step title keeps its text; its checkbox is named by its bold lead, or by its text" |
| L2-T11-M33 | blank text in a body is left alone | `src/enhance/plans.ts` | ` && (c as Text).data.trim() !== '') journal.wrap(` → `) journal.wrap(` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a body's blank text is left alone; a nested list after the title is part of the body" |
| L2-T11-M34 | a loose item marks its later blocks | `src/enhance/plans.ts` | `      if (parent !== li) {` → `      if (false) {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "what follows the title is the step's body: elements are marked, text is wrapped; a loose step marks its later blocks" |
| L2-T11-M35 | a titled step keeps its name | `src/enhance/plans.ts` | `    if (cb !== null && !cb.hasAttribute('aria-label')) {` → `    if (cb !== null) {` | `test/enhance-plans.test.ts`: 4 failed \| 33 passed \| 1 expected fail (38). "a step title's number moves into a badge before the title, its separator is hidden, and its checkbox is named"; "an owner in brackets goes into the badge; the reader's own step is marked and counted"; "what follows the title is the step's body: elements are marked, text is wrapped; a loose step marks its later blocks"; "a checkbox's name is cut to 90 characters, and an item's text is read to 300 for it" |
| L2-T11-M36 | an item with no checkbox names none | `src/enhance/plans.ts` | `    if (cb !== null && !cb.hasAttribute('aria-label')) {` → `    if (!cb.hasAttribute('aria-label')) {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an item the host changed: no checkbox, or no text, is still built without a throw" |
| L2-T11-M37 | an untitled item is named by its bold lead first | `src/enhance/plans.ts` | `lead !== '' ? lead : (li.textContent` → `false ? lead : (li.textContent` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "an item with no step title keeps its text; its checkbox is named by its bold lead, or by its text"; "a title whose first child is not text is no title, and the rest of its item is left as written" |
| L2-T11-M38 | an item with no text is named "Step" | `src/enhance/plans.ts` | ` \|\| 'Step');` → ` \|\| '');` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an item the host changed: no checkbox, or no text, is still built without a throw" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T11-M22",
    "guard": "a loose item's title is in its first paragraph",
    "file": "src/enhance/plans.ts",
    "old": " ?? cb?.parentElement?.querySelector(':scope > strong') ?? null;",
    "new": " ?? null;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M23",
    "guard": "a title whose first child is not text is no title",
    "file": "src/enhance/plans.ts",
    "old": "    if (first !== null && first.nodeType === 3) {",
    "new": "    if (first !== null) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M24",
    "guard": "an item with no bold text has no title",
    "file": "src/enhance/plans.ts",
    "old": "    if (first !== null && first.nodeType === 3) {",
    "new": "    if (first.nodeType === 3) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M25",
    "guard": "a step title splits off its title only when it has one",
    "file": "src/enhance/plans.ts",
    "old": "        if (m[0].length < text.data.length) journal.split(text, m[0].length);\n        const after",
    "new": "        journal.split(text, m[0].length);\n        const after",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M26",
    "guard": "the split goes through the journal",
    "file": "src/enhance/plans.ts",
    "old": "        const after = journal.split(text, title.length);",
    "new": "        const after = text.splitText(title.length);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M27",
    "guard": "the move goes through the journal",
    "file": "src/enhance/plans.ts",
    "old": "        journal.move(text, badge, null);",
    "new": "        badge.appendChild(text);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M28",
    "guard": "an owner anywhere in the bracket names the reader (\"yours\")",
    "file": "src/enhance/plans.ts",
    "old": "          if (vocab.addresseeAnywhere.test(owner)) {",
    "new": "          if (vocab.addressee.test(owner)) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M29",
    "guard": "a titled step with no checkbox names none",
    "file": "src/enhance/plans.ts",
    "old": "        if (cb !== null) journal.setAttribute(cb, 'aria-label', `${title}",
    "new": "        journal.setAttribute(cb, 'aria-label', `${title}",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M30",
    "guard": "a checkbox name is cut to 90 characters",
    "file": "src/enhance/plans.ts",
    "old": "const STEP_LABEL_MAX = 90;",
    "new": "const STEP_LABEL_MAX = 900;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M31",
    "guard": "an item's text is read to 300 characters",
    "file": "src/enhance/plans.ts",
    "old": "const ITEM_TEXT_MAX = 300;",
    "new": "const ITEM_TEXT_MAX = 3000;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M32",
    "guard": "only what follows the title is the body",
    "file": "src/enhance/plans.ts",
    "old": "        if (!past) continue;\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M33",
    "guard": "blank text in a body is left alone",
    "file": "src/enhance/plans.ts",
    "old": " && (c as Text).data.trim() !== '') journal.wrap(",
    "new": ") journal.wrap(",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M34",
    "guard": "a loose item marks its later blocks",
    "file": "src/enhance/plans.ts",
    "old": "      if (parent !== li) {",
    "new": "      if (false) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M35",
    "guard": "a titled step keeps its name",
    "file": "src/enhance/plans.ts",
    "old": "    if (cb !== null && !cb.hasAttribute('aria-label')) {",
    "new": "    if (cb !== null) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M36",
    "guard": "an item with no checkbox names none",
    "file": "src/enhance/plans.ts",
    "old": "    if (cb !== null && !cb.hasAttribute('aria-label')) {",
    "new": "    if (!cb.hasAttribute('aria-label')) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M37",
    "guard": "an untitled item is named by its bold lead first",
    "file": "src/enhance/plans.ts",
    "old": "lead !== '' ? lead : (li.textContent",
    "new": "false ? lead : (li.textContent",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M38",
    "guard": "an item with no text is named \"Step\"",
    "file": "src/enhance/plans.ts",
    "old": " || 'Step');",
    "new": " || '');",
    "tests": "test/enhance-plans.test.ts"
  }
]
```

## The outline mode (L2-T11-M39 to L2-T11-M60)

The threshold, the parts and their tasks, "Show all", the Outline button and the `o` key, the write-behind and a destroy inside it, `position.keep` and the relayouts, reveal, and the stored outline.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T11-M39 | the outline starts at 20 steps, not above | `src/enhance/plans.ts` | `  const outlineable = steps.length >= OUTLINE_MIN_STEPS;` → `  const outlineable = steps.length > OUTLINE_MIN_STEPS;` | `test/enhance-plans.test.ts`: 19 failed \| 18 passed \| 1 expected fail (38). "every step is listed in document order, a nested one too, and the plan carries its counts" |
| L2-T11-M40 | the threshold is 20 | `src/enhance/plans.ts` | `const OUTLINE_MIN_STEPS = 20;` → `const OUTLINE_MIN_STEPS = 19;` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "starts at 20 steps: below that, no parts, no buttons, no tool and no key"; "a stored value other than true is no outline, and a short plan never reads the key" |
| L2-T11-M41 | a short plan has no outline mode | `src/enhance/plans.ts` | `  if (!outlineable) return; ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 3 failed \| 34 passed \| 1 expected fail (38). "an empty heading is no task; a task with nothing after its separator keeps an empty title"; "starts at 20 steps: below that, no parts, no buttons, no tool and no key"; "a stored value other than true is no outline, and a short plan never reads the key" |
| L2-T11-M42 | a part belongs to the innermost task | `src/enhance/plans.ts` | `  for (const t of tasks) for (const p of t.parts) ownerOf.set(p, t);` → `  for (const t of tasks) for (const p of t.parts) if (!ownerOf.has(p)) ownerOf.set(p, t);` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a part belongs to its innermost task, and two tasks with the same number are told apart" |
| L2-T11-M43 | a task opens its own parts only | `src/enhance/plans.ts` | `own: t.parts.filter((p) => ownerOf.get(p) === t)` → `own: t.parts` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a part belongs to its innermost task, and two tasks with the same number are told apart" |
| L2-T11-M44 | the button goes before the heading's controls | `src/enhance/plans.ts` | `    const ctl = Array.from(t.heading.children).find((c) => isChrome(c) && c.classList.contains('h-ct…` → `    const ctl = null;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "every task gets a "Show all" button, before the heading's controls" |
| L2-T11-M45 | a task already open changes nothing | `src/enhance/plans.ts` | `    if (o.opened === on) return; ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "revealing what an open task holds changes nothing and measures nothing again" |
| L2-T11-M46 | opening a task asks for a relayout | `src/enhance/plans.ts` | `    o.btn.textContent = on ? 'Outline' : 'Show all'; ⏎     ctx.relayout('outline');` → `    o.btn.textContent = on ? 'Outline' : 'Show all';` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "revealing what an open task holds changes nothing and measures nothing again" |
| L2-T11-M47 | turning the outline off closes every task | `src/enhance/plans.ts` | `    if (!on) for (const o of outlinedOf.values()) openTask(o, false); ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). ""Show all" opens one task in the outline, its parts with it; turning the outline off closes every task" |
| L2-T11-M48 | the outline is written behind | `src/enhance/plans.ts` | `    state.writeDoc(OUTLINE, on ? true : null);` → (deleted) | `test/enhance-plans.test.ts`: 4 failed \| 33 passed \| 1 expected fail (38). "a stored outline is applied during the build, so the full plan is never shown first"; "o and the Outline button turn the outline on and off; each change is written behind and asks for a relayout"; "a destroy from the host's set() while the outline changes: nothing is written after it, and the root is restored"; "without storage the outline is kept for the visit only, as local state" |
| L2-T11-M49 | turning the outline off clears the stored value | `src/enhance/plans.ts` | `    state.writeDoc(OUTLINE, on ? true : null);` → `    state.writeDoc(OUTLINE, on);` | `test/enhance-plans.test.ts`: 3 failed \| 34 passed \| 1 expected fail (38). "a stored outline is applied during the build, so the full plan is never shown first"; "o and the Outline button turn the outline on and off; each change is written behind and asks for a relayout"; "without storage the outline is kept for the visit only, as local state" |
| L2-T11-M50 | no write after a destroy from the host's set() | `src/enhance/plans.ts` | `    if (!ctx.live()) return; // the host's set() ran: it may have destroyed the instance ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a destroy from the host's set() while the outline changes: nothing is written after it, and the root is restored" |
| L2-T11-M51 | the outline changes inside position.keep | `src/enhance/plans.ts` | `    ctx.position.keep(() => { ⏎       show(on); ⏎     });` → `    show(on);` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "turning the outline on or off keeps the reader's place: the root's class changes inside position.keep" |
| L2-T11-M52 | turning the outline on or off asks for a relayout | `src/enhance/plans.ts` | `      show(on); ⏎     }); ⏎     ctx.relayout('outline');` → `      show(on); ⏎     });` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "o and the Outline button turn the outline on and off; each change is written behind and asks for a relayout" |
| L2-T11-M53 | the tool only with the bar | `src/enhance/plans.ts` | `  if (ctx.slots !== null) {` → `  if (ctx.slots !== undefined) {` | `test/enhance-plans.test.ts`: 2 failed \| 35 passed \| 1 expected fail (38). "a stored outline is applied only when the reader can turn it off: with neither the bar nor the keyboard it is left as stored"; "without the bar there is no tool, and o still works; with keyboard false, o does nothing and the tool says no key" |
| L2-T11-M54 | the tool names the key only with the keyboard | `src/enhance/plans.ts` | `title: ctx.options.keyboard ? 'Show each task as its step titles (o)' : 'Show each task as its step …` → `title: 'Show each task as its step titles (o)'` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "without the bar there is no tool, and o still works; with keyboard false, o does nothing and the tool says no key" |
| L2-T11-M55 | the o key | `src/enhance/plans.ts` | `  ctx.keys.bind({ ⏎     key: 'o',` → `  void ({ ⏎     key: 'o',` | `test/enhance-plans.test.ts`: 10 failed \| 27 passed \| 1 expected fail (38). "starts at 20 steps: below that, no parts, no buttons, no tool and no key"; "a stored outline is applied during the build, so the full plan is never shown first"; "o and the Outline button turn the outline on and off; each change is written behind and asks for a relayout"; "turning the outline on or off keeps the reader's place: the root's class changes inside position.keep"; "without the bar there is no tool, and o still works; with keyboard false, o does nothing and the tool says no key" |
| L2-T11-M56 | reveal opens a task in the outline only | `src/enhance/plans.ts` | `    if (!outlined) return; ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "reveal opens the task that holds its target, in the outline only, and leaves the others closed" |
| L2-T11-M57 | reveal opens the task of a part around its target | `src/enhance/plans.ts` | `    for (let n: Element \| null = el; n !== null; n = n.parentElement) {` → `    for (let n: Element \| null = el; n !== null; n = null) {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "reveal opens the task that holds its target, in the outline only, and leaves the others closed" |
| L2-T11-M58 | only a stored true is an outline | `src/enhance/plans.ts` | `  if (state.readDoc(OUTLINE) === true) {` → `  if (state.readDoc(OUTLINE)) {` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a stored value other than true is no outline, and a short plan never reads the key" |
| L2-T11-M59 | a stored outline is the one in force | `src/enhance/plans.ts` | `    outlined = true; ⏎     show(true);` → `    show(true);` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a stored outline is applied during the build, so the full plan is never shown first" |
| L2-T11-M60 | a stored outline is applied | `src/enhance/plans.ts` | `    outlined = true; ⏎     show(true);` → `    outlined = true;` | `test/enhance-plans.test.ts`: 3 failed \| 34 passed \| 1 expected fail (38). "a stored outline is applied during the build, so the full plan is never shown first"; "a stored outline is applied only when the reader can turn it off: with neither the bar nor the keyboard it is left as stored"; "a stored value other than true is no outline, and a short plan never reads the key" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T11-M39",
    "guard": "the outline starts at 20 steps, not above",
    "file": "src/enhance/plans.ts",
    "old": "  const outlineable = steps.length >= OUTLINE_MIN_STEPS;",
    "new": "  const outlineable = steps.length > OUTLINE_MIN_STEPS;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M40",
    "guard": "the threshold is 20",
    "file": "src/enhance/plans.ts",
    "old": "const OUTLINE_MIN_STEPS = 20;",
    "new": "const OUTLINE_MIN_STEPS = 19;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M41",
    "guard": "a short plan has no outline mode",
    "file": "src/enhance/plans.ts",
    "old": "  if (!outlineable) return;\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M42",
    "guard": "a part belongs to the innermost task",
    "file": "src/enhance/plans.ts",
    "old": "  for (const t of tasks) for (const p of t.parts) ownerOf.set(p, t);",
    "new": "  for (const t of tasks) for (const p of t.parts) if (!ownerOf.has(p)) ownerOf.set(p, t);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M43",
    "guard": "a task opens its own parts only",
    "file": "src/enhance/plans.ts",
    "old": "own: t.parts.filter((p) => ownerOf.get(p) === t)",
    "new": "own: t.parts",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M44",
    "guard": "the button goes before the heading's controls",
    "file": "src/enhance/plans.ts",
    "old": "    const ctl = Array.from(t.heading.children).find((c) => isChrome(c) && c.classList.contains('h-ctl')) ?? null;",
    "new": "    const ctl = null;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M45",
    "guard": "a task already open changes nothing",
    "file": "src/enhance/plans.ts",
    "old": "    if (o.opened === on) return;\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M46",
    "guard": "opening a task asks for a relayout",
    "file": "src/enhance/plans.ts",
    "old": "    o.btn.textContent = on ? 'Outline' : 'Show all';\n    ctx.relayout('outline');",
    "new": "    o.btn.textContent = on ? 'Outline' : 'Show all';",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M47",
    "guard": "turning the outline off closes every task",
    "file": "src/enhance/plans.ts",
    "old": "    if (!on) for (const o of outlinedOf.values()) openTask(o, false);\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M48",
    "guard": "the outline is written behind",
    "file": "src/enhance/plans.ts",
    "old": "    state.writeDoc(OUTLINE, on ? true : null);",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M49",
    "guard": "turning the outline off clears the stored value",
    "file": "src/enhance/plans.ts",
    "old": "    state.writeDoc(OUTLINE, on ? true : null);",
    "new": "    state.writeDoc(OUTLINE, on);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M50",
    "guard": "no write after a destroy from the host's set()",
    "file": "src/enhance/plans.ts",
    "old": "    if (!ctx.live()) return; // the host's set() ran: it may have destroyed the instance\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M51",
    "guard": "the outline changes inside position.keep",
    "file": "src/enhance/plans.ts",
    "old": "    ctx.position.keep(() => {\n      show(on);\n    });",
    "new": "    show(on);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M52",
    "guard": "turning the outline on or off asks for a relayout",
    "file": "src/enhance/plans.ts",
    "old": "      show(on);\n    });\n    ctx.relayout('outline');",
    "new": "      show(on);\n    });",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M53",
    "guard": "the tool only with the bar",
    "file": "src/enhance/plans.ts",
    "old": "  if (ctx.slots !== null) {",
    "new": "  if (ctx.slots !== undefined) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M54",
    "guard": "the tool names the key only with the keyboard",
    "file": "src/enhance/plans.ts",
    "old": "title: ctx.options.keyboard ? 'Show each task as its step titles (o)' : 'Show each task as its step titles'",
    "new": "title: 'Show each task as its step titles (o)'",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M55",
    "guard": "the o key",
    "file": "src/enhance/plans.ts",
    "old": "  ctx.keys.bind({\n    key: 'o',",
    "new": "  void ({\n    key: 'o',",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M56",
    "guard": "reveal opens a task in the outline only",
    "file": "src/enhance/plans.ts",
    "old": "    if (!outlined) return;\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M57",
    "guard": "reveal opens the task of a part around its target",
    "file": "src/enhance/plans.ts",
    "old": "    for (let n: Element | null = el; n !== null; n = n.parentElement) {",
    "new": "    for (let n: Element | null = el; n !== null; n = null) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M58",
    "guard": "only a stored true is an outline",
    "file": "src/enhance/plans.ts",
    "old": "  if (state.readDoc(OUTLINE) === true) {",
    "new": "  if (state.readDoc(OUTLINE)) {",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M59",
    "guard": "a stored outline is the one in force",
    "file": "src/enhance/plans.ts",
    "old": "    outlined = true;\n    show(true);",
    "new": "    show(true);",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M60",
    "guard": "a stored outline is applied",
    "file": "src/enhance/plans.ts",
    "old": "    outlined = true;\n    show(true);",
    "new": "    outlined = true;",
    "tests": "test/enhance-plans.test.ts"
  }
]
```

## RF3: the large plan (L2-T11-M61)

A quadratic step added to the build: the case's budget and its 2× ratio.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T11-M61 | RF3: the build grows linearly with the plan (a quadratic count of earlier marked steps reddens it) | `src/enhance/plans.ts` | `  for (const li of steps) { ⏎     const cb` → `  for (const li of steps) { ⏎     yours += steps.slice(0, steps.indexOf(li)).filter((x) => x.classLi…` | `test/enhance-plans-rf3.test.ts`: 1 failed (1). "RF3: the build and an outline toggle stay within a measured budget, and a 2× plan takes at most 2.5× the time" expected 3671.851864 to be less than or equal to 2975.6113900000037 (the 2× build against 2.5 times the large plan's). |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T11-M61",
    "guard": "RF3: the build grows linearly with the plan (a quadratic count of earlier marked steps reddens it)",
    "file": "src/enhance/plans.ts",
    "old": "  for (const li of steps) {\n    const cb",
    "new": "  for (const li of steps) {\n    yours += steps.slice(0, steps.indexOf(li)).filter((x) => x.classList.contains('attn') && x.classList.contains('nope')).length;\n    const cb",
    "tests": "test/enhance-plans-rf3.test.ts"
  }
]
```

## After the review (L2-T11-M62 to L2-T11-M70)

The rows the review asked for: the publish of `ctx.plan`, the owner line's white space, the task heading's name, the stored outline with no way out of it, plans' exports, and RF3's toggle.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T11-M62 | ctx.plan is published during the build | `src/enhance/plans.ts` | `  ctx.plan.publish({ tasks: tasks.map((t) => t.heading), steps, yours, outlineable }); ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 9 failed \| 28 passed \| 1 expected fail (38). "a task heading, an h3 or an h2, in either grammar, takes its number into a badge, keeps its text and is named by it"; "a heading that does not open with a task number, or whose first child is not text, is no task"; "an empty heading is no task; a task with nothing after its separator keeps an empty title"; "a chrome heading an earlier feature made is no task"; "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M63 | an owner line's white space is squashed before its owner is read | `src/enhance/plans.ts` | `who = vocab.plan.who.exec(squash(raw))?.[1]` → `who = vocab.plan.who.exec(raw)?.[1]` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not" |
| L2-T11-M64 | a task's name keeps text an earlier feature wrapped in chrome (headCtl's rule) | `src/enhance/plans.ts` | `journal.setAttribute(h, 'aria-label', headingText(h, isControl));` → `journal.setAttribute(h, 'aria-label', headingText(h, isChrome));` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a task heading is named as headCtl names a heading: a chrome button left out, text in other chrome kept" |
| L2-T11-M65 | a task's name leaves out a chrome button | `src/enhance/plans.ts` | `journal.setAttribute(h, 'aria-label', headingText(h, isControl));` → `journal.setAttribute(h, 'aria-label', squash(h.textContent ?? ''));` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a task heading is named as headCtl names a heading: a chrome button left out, text in other chrome kept" |
| L2-T11-M66 | a stored outline is not applied when the reader has no way out of it | `src/enhance/plans.ts` | `  if (ctx.slots === null && !ctx.options.keyboard) return; ⏎ ` → (deleted) | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a stored outline is applied only when the reader can turn it off: with neither the bar nor the keyboard it is left as stored" |
| L2-T11-M67 | the key alone is a way out | `src/enhance/plans.ts` | `  if (ctx.slots === null && !ctx.options.keyboard) return;` → `  if (ctx.slots === null) return;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a stored outline is applied only when the reader can turn it off: with neither the bar nor the keyboard it is left as stored" |
| L2-T11-M68 | the tool alone is a way out | `src/enhance/plans.ts` | `  if (ctx.slots === null && !ctx.options.keyboard) return;` → `  if (!ctx.options.keyboard) return;` | `test/enhance-plans.test.ts`: 1 failed \| 36 passed \| 1 expected fail (38). "a stored outline is applied only when the reader can turn it off: with neither the bar nor the keyboard it is left as stored" |
| L2-T11-M69 | plans exports build only (C49) | `src/enhance/plans.ts` | ` ⏎ const OUTLINE = 'outline';` → ` ⏎ export const OUTLINE = 'outline';` | `test/enhance-seams.test.ts`: 1 failed \| 95 passed (96). "every module of src/enhance that exports build is registered, under its file name, and every stub exports build (and after when it waits on the host)" |
| L2-T11-M70 | RF3: an outline toggle grows linearly with the plan (a quadratic search over the steps in each show, both ways, reddens it) | `src/enhance/plans.ts` | `  const show = (on: boolean): void => { ⏎ ` → `  const show = (on: boolean): void => { ⏎     yours += steps.filter((x) => steps.indexOf(x) !== step…` | `test/enhance-plans-rf3.test.ts`: 1 failed (1). "RF3: the build and an outline toggle stay within a measured budget, and a 2× plan takes at most 2.5× the time" expected 13.474969099999726 to be less than or equal to 7.97203399999853 (the 2× toggle against 2.5 times the large plan's). |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T11-M62",
    "guard": "ctx.plan is published during the build",
    "file": "src/enhance/plans.ts",
    "old": "  ctx.plan.publish({ tasks: tasks.map((t) => t.heading), steps, yours, outlineable });\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M63",
    "guard": "an owner line's white space is squashed before its owner is read",
    "file": "src/enhance/plans.ts",
    "old": "who = vocab.plan.who.exec(squash(raw))?.[1]",
    "new": "who = vocab.plan.who.exec(raw)?.[1]",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M64",
    "guard": "a task's name keeps text an earlier feature wrapped in chrome (headCtl's rule)",
    "file": "src/enhance/plans.ts",
    "old": "journal.setAttribute(h, 'aria-label', headingText(h, isControl));",
    "new": "journal.setAttribute(h, 'aria-label', headingText(h, isChrome));",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M65",
    "guard": "a task's name leaves out a chrome button",
    "file": "src/enhance/plans.ts",
    "old": "journal.setAttribute(h, 'aria-label', headingText(h, isControl));",
    "new": "journal.setAttribute(h, 'aria-label', squash(h.textContent ?? ''));",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M66",
    "guard": "a stored outline is not applied when the reader has no way out of it",
    "file": "src/enhance/plans.ts",
    "old": "  if (ctx.slots === null && !ctx.options.keyboard) return;\n",
    "new": "",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M67",
    "guard": "the key alone is a way out",
    "file": "src/enhance/plans.ts",
    "old": "  if (ctx.slots === null && !ctx.options.keyboard) return;",
    "new": "  if (ctx.slots === null) return;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M68",
    "guard": "the tool alone is a way out",
    "file": "src/enhance/plans.ts",
    "old": "  if (ctx.slots === null && !ctx.options.keyboard) return;",
    "new": "  if (!ctx.options.keyboard) return;",
    "tests": "test/enhance-plans.test.ts"
  },
  {
    "id": "L2-T11-M69",
    "guard": "plans exports build only (C49)",
    "file": "src/enhance/plans.ts",
    "old": "\nconst OUTLINE = 'outline';",
    "new": "\nexport const OUTLINE = 'outline';",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T11-M70",
    "guard": "RF3: an outline toggle grows linearly with the plan (a quadratic search over the steps in each show, both ways, reddens it)",
    "file": "src/enhance/plans.ts",
    "old": "  const show = (on: boolean): void => {\n",
    "new": "  const show = (on: boolean): void => {\n    yours += steps.filter((x) => steps.indexOf(x) !== steps.lastIndexOf(x)).length;\n",
    "tests": "test/enhance-plans-rf3.test.ts"
  }
]
```

## The coordinator's commit at rebase: a fold named as the reference named it (L2-T11-M71)

The review found that an h2 task's fold was named without its task number ("Fold or unfold: Ship it"), where the
reference named it before plans ran ("Fold or unfold: Task 3: Ship it"). The fix is in `src/enhance/folds.ts`, Task
7b's file, so the coordinator made it at rebase (C53). A fold is now named from its heading's own label when an earlier
feature gave it one: plans names a task heading with its task number, before the badge becomes chrome. The case that
stated the reference's names as a known failure (`it.fails`) is now an ordinary case, and the suite has no expected
failure left. Measured 2026-10-20 on `l2-t11-plans`, rebased onto `main`, with the change uncommitted, by `mutate.mjs`
on a throwaway copy; the checkout's status was the same before and after.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T11-M71 | a fold is named from its heading's own label when an earlier feature gave it one | `src/enhance/folds.ts` | `(h.getAttribute('aria-label') ?? headingText(h, isChrome))` → `(headingText(h, isChrome))` | `test/enhance-plans.test.ts`: 1 failed \| 52 passed (53). "an h2 task's fold is named as the reference named it, its task number included" |

```json
[
  {
    "id": "L2-T11-M71",
    "guard": "a fold is named from its heading's own label when an earlier feature gave it one",
    "file": "src/enhance/folds.ts",
    "old": "    const bare = (h.getAttribute('aria-label') ?? headingText(h, isChrome)).replace(",
    "new": "    const bare = (headingText(h, isChrome)).replace(",
    "tests": "--project unit test/enhance-plans.test.ts test/enhance-folds.test.ts"
  }
]
```

## Visual check

**The plan sample, full and in outline.** `scripts/demo/samples/plans.md`, built into the demo
(`scripts/demo/build.mjs --sample`) from commit `c3e1715`, was compared with the reference layout run on a temporary
copy of the same sample (C5). `scripts/visual/compare.mjs` compared the two at 1440×1000 and 390×844 in five states:
light, dark and sans with wide (the full plan), `outline` (the Outline button pressed on each page), and
`outline-open` (then the second task's "Show all"). A setup module of the run's own pressed the buttons. In all ten
combinations 58 blocks are in both pages, with 0 unexpected differences. The expected ones, named in the run's
`--expected` file:

- the meta line, hidden and not removed (C43): `p@3-3` is in our page only;
- the contents rail is not built yet (Task 18): on the desktop the reference's column sits beside its rail, so its
  auto margins resolve differently, and every box is equal;
- the review strip is not built yet (Task 20): on both viewports the reference puts it between the byline and the
  first section, so the first h2's gap differs;
- in the outline on the desktop, a block the outline hides has no box in either page, so its x reads as the page's
  column origin, which the rail moves (Task 18): 20 px apart.

The phone is equal in every state apart from the first two. In the outline every hidden block is hidden on both pages
(`display: none` on each), and every step's box, a tight step's one row included, is equal to 0.1 px.

**The core sample is unchanged.** The demo of `scripts/demo/samples/core.md`, which holds no plan, was built from the
branch's parent (`c81864a`) and from `c3e1715` and compared with `--offline`: 48 blocks in both pages and 0
differences in each of the six combinations, and the full-page screenshots byte-identical.

**After the review.** The visual check was not run again. The review's fixes change nothing it measured: the sample's
task headings hold no chrome before plans builds, so their names read as they did; both pages ran with the bar, so a
stored outline is applied as before; and the Level 2 cases' expected files moved only in the owner table's one cell,
whose text the review asked to change.
