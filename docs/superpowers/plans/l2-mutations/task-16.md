# L2 Task 16: mutation rows (the quick jump and the keys sheet)

Each guard of Task 16, deleted or inverted once, with the tests that go red: the quick jump (`src/enhance/jump.ts`)
and the keys sheet (`src/enhance/keysheet.ts`). Measured 2026-10-20 on branch `l2-t16-jump`, on commit `5dda33c`, every
row, L2-T16-M1 to L2-T16-M132: 132 measured red (`rc=1`), none green. Fix round 1, the same day, on commit `f9bfbd3`:
L2-T16-M133 to L2-T16-M155, 23 measured red, none green; and two earlier rows re-measured there, red, because the
fix moved their lines: L2-T16-M95 (now the shared helper's line, so it reddens going too) and L2-T16-M116 (its `old`
rewritten for the new line). The other rows' Red columns are the first measurement's, at 44 cases; the fix round
renamed one case they cite, "only keys next to each other share a row", to "keys next to each other with one label
share a row; only keys next to each other do", and grew the file to 52 cases.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a 512 MiB
output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict). Each row is
applied to its own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules`
linked from the checkout), its tests run there with the local `vitest`, and the copy is deleted. Each `old` occurs
exactly once in its file. Most rows run `test/enhance-jump.test.ts` (jsdom); L2-T16-M67, L2-T16-M111, L2-T16-M129,
L2-T16-M132, L2-T16-M145 and L2-T16-M149 run the browser cases, `test/browser/jump.test.ts` (M111, M132, M145 and M149
with the jsdom file beside them). Every row ran with `DOCREADER_BROWSERS=chromium`, one at a time, in seven batches
and one for the fix round; no row is WebKit's alone, and WebKit ran the browser cases green in the Playwright image
(C51), before the fix round and after it. The checkout was never edited: `git status --porcelain` read the same
(empty) before and after, and so did `HEAD` and the hash of `git diff`, in both rounds. The Red column gives the count line and the
failing tests the run printed (at most five here). Every count line adds up to its total.

Notes on the measurement.
- Checks no case could redden were dropped before the rows were written, not reported (C49): the focus given back
  only to an element still in the page (a disconnected element takes no focus anyway), a guard on the focus call, an
  opener cleared after use, a second "already open" check on the sheet (the keyboard layer opens nothing over a
  dialog), a merge of the three lists into document order (only entries of one kind can tie in the ranking, so no
  order across the lists is ever seen), a cut of an ID (the index bounds it), a check that a row's `li` is the
  list's, a check that the section number is an h2's (only an h2 gets one), and the sheet's walk of the box's
  controls with its rect filter (the box holds one control).
- The Level 2 cases (`conformance/layout/jump/`) pin the closed dialogs' structure and are no rows. They do not see
  the wrapper: it is a classless chrome div, outside their scoped snapshot, and with M111 or M132 applied both Level 2
  jump cases stay green (measured in the review). The wrapper is pinned by the jsdom structure cases and the browser
  viewport cases, the Red columns of M111 and M132.
- The two edits to Task 7a's and 7b's test files are no guards: the services cases run without the two features,
  whose keys, overlays and tool their probes stand in for, and the seams case counts the features' chrome ids as
  released.

## What the jump lists: `src/enhance/jump.ts` (L2-T16-M1 to L2-T16-M30)

The entries: each h2 and h3 with an id (no chrome heading; of the "In short" box only its h2, the chrome box alone), an h3 task a Task and an h2 one a Section, the section number from editorial.ts's chrome `sec-no` alone, a heading read by its label (its aria-label, else its text without chrome; a blank label is none), an h2 without its number; the IDs but lettered sections and figure IDs, a rule as "Rule"; the figures as "Fig N"; every text cut to 200 code units; four entries or fewer build nothing; an empty query lists the first 80 headings alone, and a query the best 80.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T16-M1 | four entries or fewer build no jump | `src/enhance/jump.ts` | `  if (entries.length <= MIN_ENTRIES) return;` → `  if (entries.length < MIN_ENTRIES) return;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "four entries or fewer build no jump: no dialog, no button, no key; a fifth builds it" |
| L2-T16-M2 | the bound is four entries | `src/enhance/jump.ts` | `const MIN_ENTRIES = 4;` → `const MIN_ENTRIES = 5;` | `test/enhance-jump.test.ts`: 6 failed \| 38 passed (44). "four entries or fewer build no jump: no dialog, no button, no key; a fifth builds it"; "every match in a text is tried, not only the first"; "equal scores keep document order"; "a word starts in any script: a letter after an apostrophe, not one after a letter; a query that opens on a sign needs a word before it"; "the character before a match is read whole: a letter beyond the first plane, and the first character of a text" (and 1 more printed) |
| L2-T16-M3 | the headings are the h2 and h3 with an id | `src/enhance/jump.ts` | `root.querySelectorAll('h2[id], h3[id]')` → `root.querySelectorAll('h2, h3, h4')` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label" |
| L2-T16-M4 | a chrome heading is not listed | `src/enhance/jump.ts` | `    if (isChrome(h)) continue; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed" |
| L2-T16-M5 | of the "In short" box only its h2 | `src/enhance/jump.ts` | `    if (box !== null && box.firstElementChild !== h) continue; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 8 failed \| 36 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a heading reads as written, never its chrome: a badge with counts, a button, the controls"; "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant"; "each row place has a chrome id of its own, made once: typing never issues more" (and 3 more printed) |
| L2-T16-M6 | the "In short" box is the chrome one, not a host's | `src/enhance/jump.ts` | `    if (n.classList.contains('short') && isChrome(n)) return n;` → `    if (n.classList.contains('short')) return n;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label" |
| L2-T16-M7 | an h3 task of the plan is a Task | `src/enhance/jump.ts` | `      kind: !h2 && tasks.has(h) ? 'Task' : 'Section',` → `      kind: 'Section',` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed" |
| L2-T16-M8 | an h2 task stays a Section | `src/enhance/jump.ts` | `      kind: !h2 && tasks.has(h) ? 'Task' : 'Section',` → `      kind: tasks.has(h) ? 'Task' : 'Section',` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed" |
| L2-T16-M9 | a section number is a chrome sec-no, not a host's | `src/enhance/jump.ts` | `first.nodeType === 1 && isChrome(first as Element) && (first as Element).classList.contains('sec-no'…` → `first.nodeType === 1 && (first as Element).classList.contains('sec-no');` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label" |
| L2-T16-M10 | a section number is the sec-no, not any chrome first child | `src/enhance/jump.ts` | `first.nodeType === 1 && isChrome(first as Element) && (first as Element).classList.contains('sec-no'…` → `first.nodeType === 1 && isChrome(first as Element);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a heading reads as written, never its chrome: a badge with counts, a button, the controls" |
| L2-T16-M11 | an h2's label loses its section number | `src/enhance/jump.ts` | `ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX)` → `ctx.text.clip(label, TEXT_MAX)` | `test/enhance-jump.test.ts`: 6 failed \| 38 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a heading reads as written, never its chrome: a badge with counts, a button, the controls"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "an empty query lists the headings alone, never an ID or a figure" (and 1 more printed) |
| L2-T16-M12 | only an h2's label loses it | `src/enhance/jump.ts` | `ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX)` → `ctx.text.clip(label.replace(SECTION_NUMBER, ''), TEXT_MAX)` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label" |
| L2-T16-M13 | a heading reads by its aria-label first | `src/enhance/jump.ts` | `  return given !== '' ? given : headingText(h, isChrome);` → `  return headingText(h, isChrome);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a heading reads as written, never its chrome: a badge with counts, a button, the controls" |
| L2-T16-M14 | a blank aria-label is no label | `src/enhance/jump.ts` | `  const given = (h.getAttribute('aria-label') ?? '').trim();` → `  const given = h.getAttribute('aria-label') ?? '';` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label" |
| L2-T16-M15 | without a label, a heading's chrome is left out | `src/enhance/jump.ts` | `  return given !== '' ? given : headingText(h, isChrome);` → `  return given !== '' ? given : headingText(h, () => false);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a heading reads as written, never its chrome: a badge with counts, a button, the controls" |
| L2-T16-M16 | lettered sections are not listed as IDs | `src/enhance/jump.ts` | `    if (e.kind === 'section' \|\| e.kind === 'figure') continue;` → `    if (e.kind === 'figure') continue;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice" |
| L2-T16-M17 | figure IDs are not listed twice | `src/enhance/jump.ts` | `    if (e.kind === 'section' \|\| e.kind === 'figure') continue;` → `    if (e.kind === 'section') continue;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice" |
| L2-T16-M18 | a rule's kind is Rule | `src/enhance/jump.ts` | `      kind: e.kind === 'rule' ? 'Rule' : ctx.text.clip(e.group, TEXT_MAX),` → `      kind: ctx.text.clip(e.group, TEXT_MAX),` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)" |
| L2-T16-M19 | the IDs are listed | `src/enhance/jump.ts` | `  const entries = [...headingEntries(ctx), ...idEntries(ctx), ...figureEntries(ctx)];` → `  const entries = [...headingEntries(ctx), ...figureEntries(ctx)];` | `test/enhance-jump.test.ts`: 6 failed \| 38 passed (44). "four entries or fewer build no jump: no dialog, no button, no key; a fifth builds it"; "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "every text is cut to 200 code units: a heading, an ID's title and group, a caption"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" (and 1 more printed) |
| L2-T16-M20 | the figures are listed | `src/enhance/jump.ts` | `  const entries = [...headingEntries(ctx), ...idEntries(ctx), ...figureEntries(ctx)];` → `  const entries = [...headingEntries(ctx), ...idEntries(ctx)];` | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "every text is cut to 200 code units: a heading, an ID's title and group, a caption"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M21 | a figure's tag is "Fig N" | `src/enhance/jump.ts` | ``       tag: `Fig ${f.no}`, `` → `      tag: f.no,` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M22 | a heading is cut to 200 | `src/enhance/jump.ts` | `    const text = ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX);` → `    const text = h2 ? label.replace(SECTION_NUMBER, '') : label;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "every text is cut to 200 code units: a heading, an ID's title and group, a caption" |
| L2-T16-M23 | an ID's title is cut to 200 | `src/enhance/jump.ts` | `    const text = ctx.text.clip(e.title, TEXT_MAX);` → `    const text = e.title;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "every text is cut to 200 code units: a heading, an ID's title and group, a caption" |
| L2-T16-M24 | an ID's group is cut to 200 | `src/enhance/jump.ts` | `      kind: e.kind === 'rule' ? 'Rule' : ctx.text.clip(e.group, TEXT_MAX),` → `      kind: e.kind === 'rule' ? 'Rule' : e.group,` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "every text is cut to 200 code units: a heading, an ID's title and group, a caption" |
| L2-T16-M25 | a caption is cut to 200 | `src/enhance/jump.ts` | `    const text = ctx.text.clip(f.caption, TEXT_MAX);` → `    const text = f.caption;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "every text is cut to 200 code units: a heading, an ID's title and group, a caption" |
| L2-T16-M26 | the cut is 200 code units | `src/enhance/jump.ts` | `const TEXT_MAX = 200;` → `const TEXT_MAX = 400;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "every text is cut to 200 code units: a heading, an ID's title and group, a caption" |
| L2-T16-M27 | an empty query lists the headings alone | `src/enhance/jump.ts` | `    shown = q === '' ? entries.filter((x) => x.heading).slice(0, ROWS_MAX) : rank(entries, q);` → `    shown = q === '' ? entries.slice(0, ROWS_MAX) : rank(entries, q);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an empty query lists the headings alone, never an ID or a figure" |
| L2-T16-M28 | an empty query lists at most 80 | `src/enhance/jump.ts` | `    shown = q === '' ? entries.filter((x) => x.heading).slice(0, ROWS_MAX) : rank(entries, q);` → `    shown = q === '' ? entries.filter((x) => x.heading) : rank(entries, q);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query" |
| L2-T16-M29 | a query lists at most 80 | `src/enhance/jump.ts` | `  return hits.slice(0, ROWS_MAX).map((h) => h.x);` → `  return hits.map((h) => h.x);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query" |
| L2-T16-M30 | the bound is 80 rows | `src/enhance/jump.ts` | `const ROWS_MAX = 80;` → `const ROWS_MAX = 81;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T16-M1",
    "guard": "four entries or fewer build no jump",
    "file": "src/enhance/jump.ts",
    "old": "  if (entries.length <= MIN_ENTRIES) return;",
    "new": "  if (entries.length < MIN_ENTRIES) return;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M2",
    "guard": "the bound is four entries",
    "file": "src/enhance/jump.ts",
    "old": "const MIN_ENTRIES = 4;",
    "new": "const MIN_ENTRIES = 5;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M3",
    "guard": "the headings are the h2 and h3 with an id",
    "file": "src/enhance/jump.ts",
    "old": "root.querySelectorAll('h2[id], h3[id]')",
    "new": "root.querySelectorAll('h2, h3, h4')",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M4",
    "guard": "a chrome heading is not listed",
    "file": "src/enhance/jump.ts",
    "old": "    if (isChrome(h)) continue;\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M5",
    "guard": "of the \"In short\" box only its h2",
    "file": "src/enhance/jump.ts",
    "old": "    if (box !== null && box.firstElementChild !== h) continue;\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M6",
    "guard": "the \"In short\" box is the chrome one, not a host's",
    "file": "src/enhance/jump.ts",
    "old": "    if (n.classList.contains('short') && isChrome(n)) return n;",
    "new": "    if (n.classList.contains('short')) return n;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M7",
    "guard": "an h3 task of the plan is a Task",
    "file": "src/enhance/jump.ts",
    "old": "      kind: !h2 && tasks.has(h) ? 'Task' : 'Section',",
    "new": "      kind: 'Section',",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M8",
    "guard": "an h2 task stays a Section",
    "file": "src/enhance/jump.ts",
    "old": "      kind: !h2 && tasks.has(h) ? 'Task' : 'Section',",
    "new": "      kind: tasks.has(h) ? 'Task' : 'Section',",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M9",
    "guard": "a section number is a chrome sec-no, not a host's",
    "file": "src/enhance/jump.ts",
    "old": "first.nodeType === 1 && isChrome(first as Element) && (first as Element).classList.contains('sec-no');",
    "new": "first.nodeType === 1 && (first as Element).classList.contains('sec-no');",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M10",
    "guard": "a section number is the sec-no, not any chrome first child",
    "file": "src/enhance/jump.ts",
    "old": "first.nodeType === 1 && isChrome(first as Element) && (first as Element).classList.contains('sec-no');",
    "new": "first.nodeType === 1 && isChrome(first as Element);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M11",
    "guard": "an h2's label loses its section number",
    "file": "src/enhance/jump.ts",
    "old": "ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX)",
    "new": "ctx.text.clip(label, TEXT_MAX)",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M12",
    "guard": "only an h2's label loses it",
    "file": "src/enhance/jump.ts",
    "old": "ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX)",
    "new": "ctx.text.clip(label.replace(SECTION_NUMBER, ''), TEXT_MAX)",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M13",
    "guard": "a heading reads by its aria-label first",
    "file": "src/enhance/jump.ts",
    "old": "  return given !== '' ? given : headingText(h, isChrome);",
    "new": "  return headingText(h, isChrome);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M14",
    "guard": "a blank aria-label is no label",
    "file": "src/enhance/jump.ts",
    "old": "  const given = (h.getAttribute('aria-label') ?? '').trim();",
    "new": "  const given = h.getAttribute('aria-label') ?? '';",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M15",
    "guard": "without a label, a heading's chrome is left out",
    "file": "src/enhance/jump.ts",
    "old": "  return given !== '' ? given : headingText(h, isChrome);",
    "new": "  return given !== '' ? given : headingText(h, () => false);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M16",
    "guard": "lettered sections are not listed as IDs",
    "file": "src/enhance/jump.ts",
    "old": "    if (e.kind === 'section' || e.kind === 'figure') continue;",
    "new": "    if (e.kind === 'figure') continue;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M17",
    "guard": "figure IDs are not listed twice",
    "file": "src/enhance/jump.ts",
    "old": "    if (e.kind === 'section' || e.kind === 'figure') continue;",
    "new": "    if (e.kind === 'section') continue;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M18",
    "guard": "a rule's kind is Rule",
    "file": "src/enhance/jump.ts",
    "old": "      kind: e.kind === 'rule' ? 'Rule' : ctx.text.clip(e.group, TEXT_MAX),",
    "new": "      kind: ctx.text.clip(e.group, TEXT_MAX),",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M19",
    "guard": "the IDs are listed",
    "file": "src/enhance/jump.ts",
    "old": "  const entries = [...headingEntries(ctx), ...idEntries(ctx), ...figureEntries(ctx)];",
    "new": "  const entries = [...headingEntries(ctx), ...figureEntries(ctx)];",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M20",
    "guard": "the figures are listed",
    "file": "src/enhance/jump.ts",
    "old": "  const entries = [...headingEntries(ctx), ...idEntries(ctx), ...figureEntries(ctx)];",
    "new": "  const entries = [...headingEntries(ctx), ...idEntries(ctx)];",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M21",
    "guard": "a figure's tag is \"Fig N\"",
    "file": "src/enhance/jump.ts",
    "old": "      tag: `Fig ${f.no}`,",
    "new": "      tag: f.no,",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M22",
    "guard": "a heading is cut to 200",
    "file": "src/enhance/jump.ts",
    "old": "    const text = ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX);",
    "new": "    const text = h2 ? label.replace(SECTION_NUMBER, '') : label;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M23",
    "guard": "an ID's title is cut to 200",
    "file": "src/enhance/jump.ts",
    "old": "    const text = ctx.text.clip(e.title, TEXT_MAX);",
    "new": "    const text = e.title;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M24",
    "guard": "an ID's group is cut to 200",
    "file": "src/enhance/jump.ts",
    "old": "      kind: e.kind === 'rule' ? 'Rule' : ctx.text.clip(e.group, TEXT_MAX),",
    "new": "      kind: e.kind === 'rule' ? 'Rule' : e.group,",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M25",
    "guard": "a caption is cut to 200",
    "file": "src/enhance/jump.ts",
    "old": "    const text = ctx.text.clip(f.caption, TEXT_MAX);",
    "new": "    const text = f.caption;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M26",
    "guard": "the cut is 200 code units",
    "file": "src/enhance/jump.ts",
    "old": "const TEXT_MAX = 200;",
    "new": "const TEXT_MAX = 400;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M27",
    "guard": "an empty query lists the headings alone",
    "file": "src/enhance/jump.ts",
    "old": "    shown = q === '' ? entries.filter((x) => x.heading).slice(0, ROWS_MAX) : rank(entries, q);",
    "new": "    shown = q === '' ? entries.slice(0, ROWS_MAX) : rank(entries, q);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M28",
    "guard": "an empty query lists at most 80",
    "file": "src/enhance/jump.ts",
    "old": "    shown = q === '' ? entries.filter((x) => x.heading).slice(0, ROWS_MAX) : rank(entries, q);",
    "new": "    shown = q === '' ? entries.filter((x) => x.heading) : rank(entries, q);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M29",
    "guard": "a query lists at most 80",
    "file": "src/enhance/jump.ts",
    "old": "  return hits.slice(0, ROWS_MAX).map((h) => h.x);",
    "new": "  return hits.map((h) => h.x);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M30",
    "guard": "the bound is 80 rows",
    "file": "src/enhance/jump.ts",
    "old": "const ROWS_MAX = 80;",
    "new": "const ROWS_MAX = 81;",
    "tests": "test/enhance-jump.test.ts"
  }
]
```

## The ranking: `src/enhance/jump.ts` (L2-T16-M31 to L2-T16-M56)

The reference's scores (100, 95, 80, 70, 60, 45, 40, 30, 25, 20, 15), no match no row, best first and document order within a score; a word start read as `\b` in any script (the character before read whole, the first character of a text, every match tried); the query matched as written, trimmed and lower-cased, against lower-cased texts and tags.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T16-M31 | an exact ID scores 100 | `src/enhance/jump.ts` | `  if (x.id && tag === q) return 100;` → `  if (x.id && tag === q) return 94;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)" |
| L2-T16-M32 | a section number scores 95 | `src/enhance/jump.ts` | `  if (x.heading && tag === q) return 95;` → `  if (x.heading && tag === q) return 79;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)" |
| L2-T16-M33 | an ID prefix scores 80 | `src/enhance/jump.ts` | `  if (x.id && tag.startsWith(q)) return 80;` → `  if (x.id && tag.startsWith(q)) return 69;` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M34 | a heading that starts with it scores 70 | `src/enhance/jump.ts` | `    if (t.startsWith(q)) return 70;` → `    if (t.startsWith(q)) return 59;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M35 | a heading word scores 60 | `src/enhance/jump.ts` | `    if (wordStart(t, q)) return 60;` → `    if (wordStart(t, q)) return 44;` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "every text is cut to 200 code units: a heading, an ID's title and group, a caption"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M36 | a heading that holds it scores 40 | `src/enhance/jump.ts` | `    return t.includes(q) ? 40 : 0;` → `    return t.includes(q) ? 29 : 0;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M37 | a figure word scores 30 | `src/enhance/jump.ts` | `    if (wordStart(t, q)) return 30;` → `    if (wordStart(t, q)) return 24;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M38 | a caption that holds it scores 15 | `src/enhance/jump.ts` | `    return t.includes(q) ? 15 : 0;` → `    return t.includes(q) ? 21 : 0;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M39 | an ID title word scores 45 | `src/enhance/jump.ts` | `  if (wordStart(t, q)) return 45;` → `  if (wordStart(t, q)) return 39;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M40 | an ID title that holds it scores 25 | `src/enhance/jump.ts` | `  if (t.includes(q)) return 25;` → `  if (t.includes(q)) return 19;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M41 | an ID that holds it scores 20 | `src/enhance/jump.ts` | `  return tag.includes(q) ? 20 : 0;` → `  return tag.includes(q) ? 14 : 0;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M42 | no match is no row | `src/enhance/jump.ts` | `    if (s > 0) hits.push({ s, i, x });` → `    hits.push({ s, i, x });` | `test/enhance-jump.test.ts`: 13 failed \| 31 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "every text is cut to 200 code units: a heading, an ID's title and group, a caption"; "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" (and 8 more printed) |
| L2-T16-M43 | best first | `src/enhance/jump.ts` | `  hits.sort((a, b) => b.s - a.s \|\| a.i - b.i);` → `  hits.sort((a, b) => a.i - b.i);` | `test/enhance-jump.test.ts`: 5 failed \| 39 passed (44). "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)"; "every match in a text is tried, not only the first"; "a word starts in any script: a letter after an apostrophe, not one after a letter; a query that opens on a sign needs a word before it"; "the character before a match is read whole: a letter beyond the first plane, and the first character of a text" |
| L2-T16-M44 | equal scores in document order | `src/enhance/jump.ts` | `  hits.sort((a, b) => b.s - a.s \|\| a.i - b.i);` → `  hits.sort((a, b) => b.s - a.s \|\| b.i - a.i);` | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query"; "equal scores keep document order"; "the character before a match is read whole: a letter beyond the first plane, and the first character of a text" |
| L2-T16-M45 | a word starts by \b: a word character on one side, not the other | `src/enhance/jump.ts` | `    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;` → `    if (!WORD_END.test(t.slice(Math.max(0, i - 2), i))) return true;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a word starts in any script: a letter after an apostrophe, not one after a letter; a query that opens on a sign needs a word before it" |
| L2-T16-M46 | the character before is read whole (two code units) | `src/enhance/jump.ts` | `    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;` → `    if (WORD_END.test(t.slice(Math.max(0, i - 1), i)) !== first) return true;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the character before a match is read whole: a letter beyond the first plane, and the first character of a text" |
| L2-T16-M47 | the character before the second one is the first | `src/enhance/jump.ts` | `    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;` → `    if (WORD_END.test(t.slice(i - 2, i)) !== first) return true;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the character before a match is read whole: a letter beyond the first plane, and the first character of a text" |
| L2-T16-M48 | the query's first character in any script | `src/enhance/jump.ts` | `const WORD_START = /^[\p{L}\p{M}\p{N}_]/u;` → `const WORD_START = /^\w/;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a word starts in any script: a letter after an apostrophe, not one after a letter; a query that opens on a sign needs a word before it" |
| L2-T16-M49 | the character before in any script | `src/enhance/jump.ts` | `const WORD_END = /[\p{L}\p{M}\p{N}_]$/u;` → `const WORD_END = /\w$/;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the character before a match is read whole: a letter beyond the first plane, and the first character of a text" |
| L2-T16-M50 | every match is tried | `src/enhance/jump.ts` | `  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1)) {` → `  for (let i = t.indexOf(q); i >= 0; i = -1) {` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "every match in a text is tried, not only the first" |
| L2-T16-M51 | the query is matched as written, not as a pattern | `src/enhance/jump.ts` | `    return t.includes(q) ? 40 : 0;` → `    return new RegExp(q).test(t) ? 40 : 0;` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the query is matched as written: metacharacters are themselves" |
| L2-T16-M52 | the query is lower-cased | `src/enhance/jump.ts` | `    const q = input.value.trim().toLowerCase();` → `    const q = input.value.trim();` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M53 | the query is trimmed | `src/enhance/jump.ts` | `    const q = input.value.trim().toLowerCase();` → `    const q = input.value.toLowerCase();` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M54 | a heading's text is lower-cased | `src/enhance/jump.ts` | `      low: text.toLowerCase(), ⏎       lowTag: no.toLowerCase(),` → `      low: text, ⏎       lowTag: no.toLowerCase(),` | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M55 | an ID is lower-cased | `src/enhance/jump.ts` | `      lowTag: tag.toLowerCase(),` → `      lowTag: tag,` | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M56 | a heading's tag is its section number | `src/enhance/jump.ts` | `      lowTag: no.toLowerCase(),` → `      lowTag: '',` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T16-M31",
    "guard": "an exact ID scores 100",
    "file": "src/enhance/jump.ts",
    "old": "  if (x.id && tag === q) return 100;",
    "new": "  if (x.id && tag === q) return 94;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M32",
    "guard": "a section number scores 95",
    "file": "src/enhance/jump.ts",
    "old": "  if (x.heading && tag === q) return 95;",
    "new": "  if (x.heading && tag === q) return 79;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M33",
    "guard": "an ID prefix scores 80",
    "file": "src/enhance/jump.ts",
    "old": "  if (x.id && tag.startsWith(q)) return 80;",
    "new": "  if (x.id && tag.startsWith(q)) return 69;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M34",
    "guard": "a heading that starts with it scores 70",
    "file": "src/enhance/jump.ts",
    "old": "    if (t.startsWith(q)) return 70;",
    "new": "    if (t.startsWith(q)) return 59;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M35",
    "guard": "a heading word scores 60",
    "file": "src/enhance/jump.ts",
    "old": "    if (wordStart(t, q)) return 60;",
    "new": "    if (wordStart(t, q)) return 44;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M36",
    "guard": "a heading that holds it scores 40",
    "file": "src/enhance/jump.ts",
    "old": "    return t.includes(q) ? 40 : 0;",
    "new": "    return t.includes(q) ? 29 : 0;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M37",
    "guard": "a figure word scores 30",
    "file": "src/enhance/jump.ts",
    "old": "    if (wordStart(t, q)) return 30;",
    "new": "    if (wordStart(t, q)) return 24;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M38",
    "guard": "a caption that holds it scores 15",
    "file": "src/enhance/jump.ts",
    "old": "    return t.includes(q) ? 15 : 0;",
    "new": "    return t.includes(q) ? 21 : 0;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M39",
    "guard": "an ID title word scores 45",
    "file": "src/enhance/jump.ts",
    "old": "  if (wordStart(t, q)) return 45;",
    "new": "  if (wordStart(t, q)) return 39;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M40",
    "guard": "an ID title that holds it scores 25",
    "file": "src/enhance/jump.ts",
    "old": "  if (t.includes(q)) return 25;",
    "new": "  if (t.includes(q)) return 19;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M41",
    "guard": "an ID that holds it scores 20",
    "file": "src/enhance/jump.ts",
    "old": "  return tag.includes(q) ? 20 : 0;",
    "new": "  return tag.includes(q) ? 14 : 0;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M42",
    "guard": "no match is no row",
    "file": "src/enhance/jump.ts",
    "old": "    if (s > 0) hits.push({ s, i, x });",
    "new": "    hits.push({ s, i, x });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M43",
    "guard": "best first",
    "file": "src/enhance/jump.ts",
    "old": "  hits.sort((a, b) => b.s - a.s || a.i - b.i);",
    "new": "  hits.sort((a, b) => a.i - b.i);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M44",
    "guard": "equal scores in document order",
    "file": "src/enhance/jump.ts",
    "old": "  hits.sort((a, b) => b.s - a.s || a.i - b.i);",
    "new": "  hits.sort((a, b) => b.s - a.s || b.i - a.i);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M45",
    "guard": "a word starts by \\b: a word character on one side, not the other",
    "file": "src/enhance/jump.ts",
    "old": "    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;",
    "new": "    if (!WORD_END.test(t.slice(Math.max(0, i - 2), i))) return true;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M46",
    "guard": "the character before is read whole (two code units)",
    "file": "src/enhance/jump.ts",
    "old": "    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;",
    "new": "    if (WORD_END.test(t.slice(Math.max(0, i - 1), i)) !== first) return true;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M47",
    "guard": "the character before the second one is the first",
    "file": "src/enhance/jump.ts",
    "old": "    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;",
    "new": "    if (WORD_END.test(t.slice(i - 2, i)) !== first) return true;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M48",
    "guard": "the query's first character in any script",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_START = /^[\\p{L}\\p{M}\\p{N}_]/u;",
    "new": "const WORD_START = /^\\w/;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M49",
    "guard": "the character before in any script",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_END = /[\\p{L}\\p{M}\\p{N}_]$/u;",
    "new": "const WORD_END = /\\w$/;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M50",
    "guard": "every match is tried",
    "file": "src/enhance/jump.ts",
    "old": "  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1)) {",
    "new": "  for (let i = t.indexOf(q); i >= 0; i = -1) {",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M51",
    "guard": "the query is matched as written, not as a pattern",
    "file": "src/enhance/jump.ts",
    "old": "    return t.includes(q) ? 40 : 0;",
    "new": "    return new RegExp(q).test(t) ? 40 : 0;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M52",
    "guard": "the query is lower-cased",
    "file": "src/enhance/jump.ts",
    "old": "    const q = input.value.trim().toLowerCase();",
    "new": "    const q = input.value.trim();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M53",
    "guard": "the query is trimmed",
    "file": "src/enhance/jump.ts",
    "old": "    const q = input.value.trim().toLowerCase();",
    "new": "    const q = input.value.toLowerCase();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M54",
    "guard": "a heading's text is lower-cased",
    "file": "src/enhance/jump.ts",
    "old": "      low: text.toLowerCase(),\n      lowTag: no.toLowerCase(),",
    "new": "      low: text,\n      lowTag: no.toLowerCase(),",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M55",
    "guard": "an ID is lower-cased",
    "file": "src/enhance/jump.ts",
    "old": "      lowTag: tag.toLowerCase(),",
    "new": "      lowTag: tag,",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M56",
    "guard": "a heading's tag is its section number",
    "file": "src/enhance/jump.ts",
    "old": "      lowTag: no.toLowerCase(),",
    "new": "      lowTag: '',",
    "tests": "test/enhance-jump.test.ts"
  }
]
```

## Choosing and going: `src/enhance/jump.ts` (L2-T16-M57 to L2-T16-M85)

The selection (one `.sel` and `aria-selected`, clamped at both ends, named by the field's `aria-activedescendant`, removed when nothing is listed, kept in view through a guarded `scrollIntoView`), the row places' chrome ids made once, the rows themselves ("Nothing matches", the kinds, the tags, the numbers), the field's keys (the arrows, Enter, Tab) and typing, and the rows' delegated click.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T16-M57 | the previous row loses .sel | `src/enhance/jump.ts` | `      was.classList.remove('sel'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M58 | the previous row loses aria-selected | `src/enhance/jump.ts` | `      was.setAttribute('aria-selected', 'false'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M59 | no previous row is no write | `src/enhance/jump.ts` | `    if (was !== undefined) {` → `    if (true) {` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant"; "with nothing listed there is no active descendant, and Enter does nothing" |
| L2-T16-M60 | the selection is clamped at the end | `src/enhance/jump.ts` | `    sel = Math.max(0, Math.min(i, rows.length - 1));` → `    sel = Math.max(0, i);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M61 | the selection is clamped at the start | `src/enhance/jump.ts` | `    sel = Math.max(0, Math.min(i, rows.length - 1));` → `    sel = Math.min(i, rows.length - 1);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M62 | no row: no active descendant | `src/enhance/jump.ts` | `      input.removeAttribute('aria-activedescendant'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "with nothing listed there is no active descendant, and Enter does nothing" |
| L2-T16-M63 | the selected row takes .sel | `src/enhance/jump.ts` | `    now.classList.add('sel'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant"; "opening clears the field, lists the headings and focuses the field; opening again while open does nothing" |
| L2-T16-M64 | the selected row takes aria-selected | `src/enhance/jump.ts` | `    now.setAttribute('aria-selected', 'true'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M65 | the field names the selected row | `src/enhance/jump.ts` | `    input.setAttribute('aria-activedescendant', now.id); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M66 | scrollIntoView is guarded | `src/enhance/jump.ts` | `    if (typeof now.scrollIntoView === 'function') now.scrollIntoView({ block: 'nearest' });` → `    now.scrollIntoView({ block: 'nearest' });` | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). "opening clears the field, lists the headings and focuses the field; opening again while open does nothing"; "Escape and a click outside the box close it and give the focus back; a click inside the box does not"; "opened with nothing focused, closing takes the focus out of the hidden dialog"; ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types" |
| L2-T16-M67 | the selected row is kept in view | `src/enhance/jump.ts` | `    if (typeof now.scrollIntoView === 'function') now.scrollIntoView({ block: 'nearest' }); ⏎ ` → (deleted) | `test/browser/jump.test.ts`: 1 failed \| 4 passed \| 5 skipped (10). "the selected row stays in view of the list as the arrow keys move it, down and back up" |
| L2-T16-M68 | a row place's id is made once | `src/enhance/jump.ts` | `  const placeId = (i: number): string => (placeIds[i] ??= ctx.chromeId('jump-option'));` → `  const placeId = (i: number): string => ctx.chromeId('jump-option');` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "each row place has a chrome id of its own, made once: typing never issues more" |
| L2-T16-M69 | nothing listed: "Nothing matches" | `src/enhance/jump.ts` | `list.replaceChildren(...(rows.length > 0 ? rows : [chrome(doc, 'li', { className: 'none', text: 'Not…` → `list.replaceChildren(...rows);` | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "the query is matched as written: metacharacters are themselves"; "a hostile query of 100,000 characters stays bounded and matches nothing"; "a click on a row goes there; on "Nothing matches" nothing happens" |
| L2-T16-M70 | a list opens on its first row | `src/enhance/jump.ts` | `    select(0); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant"; "opening clears the field, lists the headings and focuses the field; opening again while open does nothing" |
| L2-T16-M71 | a row knows its entry | `src/enhance/jump.ts` | `      rowOf.set(li, x); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a click on a row goes there; on "Nothing matches" nothing happens" |
| L2-T16-M72 | only an ID row has its kind apart | `src/enhance/jump.ts` | `      if (x.id) kids.push(chrome(doc, 'span', { className: 'jk', text: x.kind }));` → `      kids.push(chrome(doc, 'span', { className: 'jk', text: x.kind }));` | `test/enhance-jump.test.ts`: 16 failed \| 28 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label"; "a heading reads as written, never its chrome: a badge with counts, a button, the controls"; "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice" (and 11 more printed) |
| L2-T16-M73 | an ID's lvl is .lvl.id | `src/enhance/jump.ts` | `className: x.id ? 'lvl id' : 'lvl',` → `className: 'lvl',` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice" |
| L2-T16-M74 | an ID or a figure shows its tag, a heading its kind | `src/enhance/jump.ts` | `text: x.id \|\| x.fig ? x.tag : x.kind });` → `text: x.kind });` | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" |
| L2-T16-M75 | a numbered heading shows its number | `src/enhance/jump.ts` | `` text: x.heading && x.no !== '' ? `${x.no}. ${x.text}` : x.text }); `` → `text: x.text });` | `test/enhance-jump.test.ts`: 6 failed \| 38 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a heading reads as written, never its chrome: a badge with counts, a button, the controls"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "an empty query lists the headings alone, never an ID or a figure" (and 1 more printed) |
| L2-T16-M76 | the down arrow moves down | `src/enhance/jump.ts` | `      select(sel + 1);` → `      select(sel);` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant"; "Enter goes to the selected entry: the dialog closes, the target has the focus, and the host hears of it" |
| L2-T16-M77 | the down arrow is the field's | `src/enhance/jump.ts` | `    if (e.key === 'ArrowDown') { ⏎       e.preventDefault(); ⏎ ` → `    if (e.key === 'ArrowDown') { ⏎ ` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M78 | the up arrow moves up | `src/enhance/jump.ts` | `      select(sel - 1);` → `      select(sel);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M79 | the up arrow is the field's | `src/enhance/jump.ts` | `    } else if (e.key === 'ArrowUp') { ⏎       e.preventDefault(); ⏎ ` → `    } else if (e.key === 'ArrowUp') { ⏎ ` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant" |
| L2-T16-M80 | Enter goes | `src/enhance/jump.ts` | `      e.preventDefault(); ⏎       go(x);` → `      e.preventDefault();` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "Enter goes to the selected entry: the dialog closes, the target has the focus, and the host hears of it"; "opening closes the preview card; going closes the contents drawer, and closing does not" |
| L2-T16-M81 | Enter with nothing listed does nothing | `src/enhance/jump.ts` | `      if (x === undefined) return; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "with nothing listed there is no active descendant, and Enter does nothing" |
| L2-T16-M82 | Tab stays in the field | `src/enhance/jump.ts` | `    } else if (e.key === 'Tab') e.preventDefault();` → `    }` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "Tab stays in the field" |
| L2-T16-M83 | typing ranks again | `src/enhance/jump.ts` | `  journal.listen(input, 'input', () => { ⏎     render(); ⏎   }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 14 failed \| 30 passed (44). "IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice"; "every text is cut to 200 code units: a heading, an ID's title and group, a caption"; "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query"; "an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)"; "then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)" (and 9 more printed) |
| L2-T16-M84 | a click on a row goes there | `src/enhance/jump.ts` | `    if (x !== undefined) go(x);` → `    if (x === undefined) go(x as unknown as Entry);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a click on a row goes there; on "Nothing matches" nothing happens" |
| L2-T16-M85 | a click on "Nothing matches" does nothing | `src/enhance/jump.ts` | `    if (x !== undefined) go(x);` → `    go(x as Entry);` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a click on a row goes there; on "Nothing matches" nothing happens" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T16-M57",
    "guard": "the previous row loses .sel",
    "file": "src/enhance/jump.ts",
    "old": "      was.classList.remove('sel');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M58",
    "guard": "the previous row loses aria-selected",
    "file": "src/enhance/jump.ts",
    "old": "      was.setAttribute('aria-selected', 'false');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M59",
    "guard": "no previous row is no write",
    "file": "src/enhance/jump.ts",
    "old": "    if (was !== undefined) {",
    "new": "    if (true) {",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M60",
    "guard": "the selection is clamped at the end",
    "file": "src/enhance/jump.ts",
    "old": "    sel = Math.max(0, Math.min(i, rows.length - 1));",
    "new": "    sel = Math.max(0, i);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M61",
    "guard": "the selection is clamped at the start",
    "file": "src/enhance/jump.ts",
    "old": "    sel = Math.max(0, Math.min(i, rows.length - 1));",
    "new": "    sel = Math.min(i, rows.length - 1);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M62",
    "guard": "no row: no active descendant",
    "file": "src/enhance/jump.ts",
    "old": "      input.removeAttribute('aria-activedescendant');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M63",
    "guard": "the selected row takes .sel",
    "file": "src/enhance/jump.ts",
    "old": "    now.classList.add('sel');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M64",
    "guard": "the selected row takes aria-selected",
    "file": "src/enhance/jump.ts",
    "old": "    now.setAttribute('aria-selected', 'true');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M65",
    "guard": "the field names the selected row",
    "file": "src/enhance/jump.ts",
    "old": "    input.setAttribute('aria-activedescendant', now.id);\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M66",
    "guard": "scrollIntoView is guarded",
    "file": "src/enhance/jump.ts",
    "old": "    if (typeof now.scrollIntoView === 'function') now.scrollIntoView({ block: 'nearest' });",
    "new": "    now.scrollIntoView({ block: 'nearest' });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M67",
    "guard": "the selected row is kept in view",
    "file": "src/enhance/jump.ts",
    "old": "    if (typeof now.scrollIntoView === 'function') now.scrollIntoView({ block: 'nearest' });\n",
    "new": "",
    "tests": "test/browser/jump.test.ts"
  },
  {
    "id": "L2-T16-M68",
    "guard": "a row place's id is made once",
    "file": "src/enhance/jump.ts",
    "old": "  const placeId = (i: number): string => (placeIds[i] ??= ctx.chromeId('jump-option'));",
    "new": "  const placeId = (i: number): string => ctx.chromeId('jump-option');",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M69",
    "guard": "nothing listed: \"Nothing matches\"",
    "file": "src/enhance/jump.ts",
    "old": "list.replaceChildren(...(rows.length > 0 ? rows : [chrome(doc, 'li', { className: 'none', text: 'Nothing matches' })]));",
    "new": "list.replaceChildren(...rows);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M70",
    "guard": "a list opens on its first row",
    "file": "src/enhance/jump.ts",
    "old": "    select(0);\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M71",
    "guard": "a row knows its entry",
    "file": "src/enhance/jump.ts",
    "old": "      rowOf.set(li, x);\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M72",
    "guard": "only an ID row has its kind apart",
    "file": "src/enhance/jump.ts",
    "old": "      if (x.id) kids.push(chrome(doc, 'span', { className: 'jk', text: x.kind }));",
    "new": "      kids.push(chrome(doc, 'span', { className: 'jk', text: x.kind }));",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M73",
    "guard": "an ID's lvl is .lvl.id",
    "file": "src/enhance/jump.ts",
    "old": "className: x.id ? 'lvl id' : 'lvl',",
    "new": "className: 'lvl',",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M74",
    "guard": "an ID or a figure shows its tag, a heading its kind",
    "file": "src/enhance/jump.ts",
    "old": "text: x.id || x.fig ? x.tag : x.kind });",
    "new": "text: x.kind });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M75",
    "guard": "a numbered heading shows its number",
    "file": "src/enhance/jump.ts",
    "old": "text: x.heading && x.no !== '' ? `${x.no}. ${x.text}` : x.text });",
    "new": "text: x.text });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M76",
    "guard": "the down arrow moves down",
    "file": "src/enhance/jump.ts",
    "old": "      select(sel + 1);",
    "new": "      select(sel);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M77",
    "guard": "the down arrow is the field's",
    "file": "src/enhance/jump.ts",
    "old": "    if (e.key === 'ArrowDown') {\n      e.preventDefault();\n",
    "new": "    if (e.key === 'ArrowDown') {\n",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M78",
    "guard": "the up arrow moves up",
    "file": "src/enhance/jump.ts",
    "old": "      select(sel - 1);",
    "new": "      select(sel);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M79",
    "guard": "the up arrow is the field's",
    "file": "src/enhance/jump.ts",
    "old": "    } else if (e.key === 'ArrowUp') {\n      e.preventDefault();\n",
    "new": "    } else if (e.key === 'ArrowUp') {\n",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M80",
    "guard": "Enter goes",
    "file": "src/enhance/jump.ts",
    "old": "      e.preventDefault();\n      go(x);",
    "new": "      e.preventDefault();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M81",
    "guard": "Enter with nothing listed does nothing",
    "file": "src/enhance/jump.ts",
    "old": "      if (x === undefined) return;\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M82",
    "guard": "Tab stays in the field",
    "file": "src/enhance/jump.ts",
    "old": "    } else if (e.key === 'Tab') e.preventDefault();",
    "new": "    }",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M83",
    "guard": "typing ranks again",
    "file": "src/enhance/jump.ts",
    "old": "  journal.listen(input, 'input', () => {\n    render();\n  });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M84",
    "guard": "a click on a row goes there",
    "file": "src/enhance/jump.ts",
    "old": "    if (x !== undefined) go(x);",
    "new": "    if (x === undefined) go(x as unknown as Entry);",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M85",
    "guard": "a click on \"Nothing matches\" does nothing",
    "file": "src/enhance/jump.ts",
    "old": "    if (x !== undefined) go(x);",
    "new": "    go(x as Entry);",
    "tests": "test/enhance-jump.test.ts"
  }
]
```

## Opening, closing, the keys and the button: `src/enhance/jump.ts` (L2-T16-M86 to L2-T16-M111)

Opening (once, remembering the focus, closing the card, clearing the field, listing and focusing it), closing (the focus back, or out of the hidden dialog), going (closing it and the drawer, a new history entry), the click outside the box, the overlay and its keys ("/", the chord off the sheet), the button (only with the bar, in the tray, its "/" hint only with the keyboard), the field's `aria-controls` and the list's chrome id, and the wrapper that lets the dialog cover the viewport.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T16-M86 | opening an open jump does nothing | `src/enhance/jump.ts` | `    if (isOpen()) return; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "opening clears the field, lists the headings and focuses the field; opening again while open does nothing" |
| L2-T16-M87 | opening remembers the focus | `src/enhance/jump.ts` | `    opener = doc.activeElement; ⏎     ctx.overlays.close('card');` → `    opener = null; ⏎     ctx.overlays.close('card');` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "Escape and a click outside the box close it and give the focus back; a click inside the box does not"; ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types" |
| L2-T16-M88 | opening closes the card | `src/enhance/jump.ts` | `    ctx.overlays.close('card'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "opening closes the preview card; going closes the contents drawer, and closing does not" |
| L2-T16-M89 | opening shows the dialog | `src/enhance/jump.ts` | `    jump.classList.add('open'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 10 failed \| 34 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "with nothing listed there is no active descendant, and Enter does nothing"; "a click on a row goes there; on "Nothing matches" nothing happens"; "opening clears the field, lists the headings and focuses the field; opening again while open does nothing"; "Escape and a click outside the box close it and give the focus back; a click inside the box does not" (and 5 more printed) |
| L2-T16-M90 | opening clears the field | `src/enhance/jump.ts` | `    input.value = ''; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "opening clears the field, lists the headings and focuses the field; opening again while open does nothing" |
| L2-T16-M91 | opening lists the headings | `src/enhance/jump.ts` | `    render(); ⏎     input.focus();` → `    input.focus();` | `test/enhance-jump.test.ts`: 12 failed \| 32 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label"; "a heading reads as written, never its chrome: a badge with counts, a button, the controls"; "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query" (and 7 more printed) |
| L2-T16-M92 | opening focuses the field | `src/enhance/jump.ts` | `    input.focus(); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). "opening clears the field, lists the headings and focuses the field; opening again while open does nothing"; "Escape and a click outside the box close it and give the focus back; a click inside the box does not"; "opened with nothing focused, closing takes the focus out of the hidden dialog" |
| L2-T16-M93 | closing hides the dialog | `src/enhance/jump.ts` | `    jump.classList.remove('open'); ⏎     if (opener` → `    if (opener` | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). "opening clears the field, lists the headings and focuses the field; opening again while open does nothing"; "Escape and a click outside the box close it and give the focus back; a click inside the box does not"; ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types"; "RF2: with two roots, "/" opens the focused root's jump, and Escape closes only its own" |
| L2-T16-M94 | closing gives the focus back | `src/enhance/jump.ts` | `    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "Escape and a click outside the box close it and give the focus back; a click inside the box does not"; ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types" |
| L2-T16-M95 | closing takes the focus out of the hidden dialog | `src/enhance/jump.ts` | `    if (now !== null && box.contains(now)) (now as HTMLElement).blur(); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 2 failed \| 50 passed (52). "going to a target that takes no focus (gone from the root) takes the focus out of the hidden dialog, and "/" opens it again"; "opened with nothing focused, closing takes the focus out of the hidden dialog" (re-measured in fix round 1: the line is now the shared helper's, for closing and going) |
| L2-T16-M96 | going hides the dialog | `src/enhance/jump.ts` | `    jump.classList.remove('open'); ⏎     ctx.overlays.close('drawer');` → `    ctx.overlays.close('drawer');` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "Enter goes to the selected entry: the dialog closes, the target has the focus, and the host hears of it"; "a click on a row goes there; on "Nothing matches" nothing happens" |
| L2-T16-M97 | going closes the drawer | `src/enhance/jump.ts` | `    ctx.overlays.close('drawer'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "opening closes the preview card; going closes the contents drawer, and closing does not" |
| L2-T16-M98 | going makes a new history entry | `src/enhance/jump.ts` | `    ctx.nav.goTo(x.target, { push: true });` → `    ctx.nav.goTo(x.target, { push: false });` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "Enter goes to the selected entry: the dialog closes, the target has the focus, and the host hears of it"; "a click on a row goes there; on "Nothing matches" nothing happens" |
| L2-T16-M99 | only a click outside the box closes it | `src/enhance/jump.ts` | `    if (e.target === jump) close();` → `    close();` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "a click on a row goes there; on "Nothing matches" nothing happens"; "Escape and a click outside the box close it and give the focus back; a click inside the box does not" |
| L2-T16-M100 | the jump is an overlay (Escape) | `src/enhance/jump.ts` | `  ctx.overlays.register('jump', { isOpen, close }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 5 failed \| 39 passed (44). "opening clears the field, lists the headings and focuses the field; opening again while open does nothing"; "Escape and a click outside the box close it and give the focus back; a click inside the box does not"; "opened with nothing focused, closing takes the focus out of the hidden dialog"; ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types"; "RF2: with two roots, "/" opens the focused root's jump, and Escape closes only its own" |
| L2-T16-M101 | "/" opens it | `src/enhance/jump.ts` | `  ctx.keys.bind({ key: '/', label: LABEL, run: openJump }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 8 failed \| 36 passed (44). "builds a closed dialog at the root's end, a button in the bar's tray, and binds "/" and the chord"; "opened with nothing focused, closing takes the focus out of the hidden dialog"; ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types"; "chrome.bar false: no button; "/" still opens it"; "RF2: with two roots, "/" opens the focused root's jump, and Escape closes only its own" (and 3 more printed) |
| L2-T16-M102 | Ctrl or Cmd with K opens it | `src/enhance/jump.ts` | `  ctx.keys.bind({ key: CHORD, label: LABEL, listed: false, run: openJump }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). ""/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types" |
| L2-T16-M103 | the chord is not on the sheet | `src/enhance/jump.ts` | `  ctx.keys.bind({ key: CHORD, label: LABEL, listed: false, run: openJump });` → `  ctx.keys.bind({ key: CHORD, label: LABEL, run: openJump });` | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). "builds a closed dialog at the root's end, a button in the bar's tray, and binds "/" and the chord"; ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not"; "only keys next to each other share a row" |
| L2-T16-M104 | the button only with the bar | `src/enhance/jump.ts` | `  if (ctx.slots !== null) {` → `  if (true) {` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "chrome.bar false: no button; "/" still opens it" |
| L2-T16-M105 | the button opens it | `src/enhance/jump.ts` | `    journal.listen(btn, 'click', () => { ⏎       openJump(); ⏎     }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 16 failed \| 28 passed (44). "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label"; "a heading reads as written, never its chrome: a badge with counts, a button, the controls"; "at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query" (and 11 more printed) |
| L2-T16-M106 | the button is in the tray | `src/enhance/jump.ts` | `    ctx.slots.tool('jump', btn); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 33 failed \| 11 passed (44). "builds a closed dialog at the root's end, a button in the bar's tray, and binds "/" and the chord"; "an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart"; "four entries or fewer build no jump: no dialog, no button, no key; a fifth builds it"; "an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed"; "a host's own markup is the document's: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label" (and 28 more printed) |
| L2-T16-M107 | the "/" hint only with the keyboard | `src/enhance/jump.ts` | `      keyboard ? [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' }), chrome(doc, 'kbd', { c…` → `      [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' }), chrome(doc, 'kbd', { className: '…` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "keyboard: false: no key opens it, and the button shows no key; the button still opens it" |
| L2-T16-M108 | the title names "/" only with the keyboard | `src/enhance/jump.ts` | `` title: keyboard ? `${LABEL} (/)` : LABEL, `` → `` title: `${LABEL} (/)`, `` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "keyboard: false: no key opens it, and the button shows no key; the button still opens it" |
| L2-T16-M109 | the field controls the list | `src/enhance/jump.ts` | `      'aria-controls': listId, ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "builds a closed dialog at the root's end, a button in the bar's tray, and binds "/" and the chord" |
| L2-T16-M110 | the list carries its chrome id | `src/enhance/jump.ts` | `  const list = chrome(doc, 'ul', { attrs: { role: 'listbox', id: listId, 'aria-label': 'Matches' } }…` → `  const list = chrome(doc, 'ul', { attrs: { role: 'listbox', 'aria-label': 'Matches' } });` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "builds a closed dialog at the root's end, a button in the bar's tray, and binds "/" and the chord"; "RF2: with two roots, "/" opens the focused root's jump, and Escape closes only its own" |
| L2-T16-M111 | the dialog is in a wrapper of its own (it covers the viewport) | `src/enhance/jump.ts` | `  journal.insert(chrome(doc, 'div', {}, [jump]), root, null);` → `  journal.insert(jump, root, null);` | `test/enhance-jump.test.ts`, `test/browser/jump.test.ts`: 2 failed \| 47 passed \| 5 skipped (54). "both dialogs cover the viewport at 1440×1000, not the reading column"; "builds a closed dialog at the root's end, a button in the bar's tray, and binds "/" and the chord" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T16-M86",
    "guard": "opening an open jump does nothing",
    "file": "src/enhance/jump.ts",
    "old": "    if (isOpen()) return;\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M87",
    "guard": "opening remembers the focus",
    "file": "src/enhance/jump.ts",
    "old": "    opener = doc.activeElement;\n    ctx.overlays.close('card');",
    "new": "    opener = null;\n    ctx.overlays.close('card');",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M88",
    "guard": "opening closes the card",
    "file": "src/enhance/jump.ts",
    "old": "    ctx.overlays.close('card');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M89",
    "guard": "opening shows the dialog",
    "file": "src/enhance/jump.ts",
    "old": "    jump.classList.add('open');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M90",
    "guard": "opening clears the field",
    "file": "src/enhance/jump.ts",
    "old": "    input.value = '';\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M91",
    "guard": "opening lists the headings",
    "file": "src/enhance/jump.ts",
    "old": "    render();\n    input.focus();",
    "new": "    input.focus();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M92",
    "guard": "opening focuses the field",
    "file": "src/enhance/jump.ts",
    "old": "    input.focus();\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M93",
    "guard": "closing hides the dialog",
    "file": "src/enhance/jump.ts",
    "old": "    jump.classList.remove('open');\n    if (opener",
    "new": "    if (opener",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M94",
    "guard": "closing gives the focus back",
    "file": "src/enhance/jump.ts",
    "old": "    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M95",
    "guard": "closing takes the focus out of the hidden dialog",
    "file": "src/enhance/jump.ts",
    "old": "    if (now !== null && box.contains(now)) (now as HTMLElement).blur();\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M96",
    "guard": "going hides the dialog",
    "file": "src/enhance/jump.ts",
    "old": "    jump.classList.remove('open');\n    ctx.overlays.close('drawer');",
    "new": "    ctx.overlays.close('drawer');",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M97",
    "guard": "going closes the drawer",
    "file": "src/enhance/jump.ts",
    "old": "    ctx.overlays.close('drawer');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M98",
    "guard": "going makes a new history entry",
    "file": "src/enhance/jump.ts",
    "old": "    ctx.nav.goTo(x.target, { push: true });",
    "new": "    ctx.nav.goTo(x.target, { push: false });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M99",
    "guard": "only a click outside the box closes it",
    "file": "src/enhance/jump.ts",
    "old": "    if (e.target === jump) close();",
    "new": "    close();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M100",
    "guard": "the jump is an overlay (Escape)",
    "file": "src/enhance/jump.ts",
    "old": "  ctx.overlays.register('jump', { isOpen, close });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M101",
    "guard": "\"/\" opens it",
    "file": "src/enhance/jump.ts",
    "old": "  ctx.keys.bind({ key: '/', label: LABEL, run: openJump });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M102",
    "guard": "Ctrl or Cmd with K opens it",
    "file": "src/enhance/jump.ts",
    "old": "  ctx.keys.bind({ key: CHORD, label: LABEL, listed: false, run: openJump });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M103",
    "guard": "the chord is not on the sheet",
    "file": "src/enhance/jump.ts",
    "old": "  ctx.keys.bind({ key: CHORD, label: LABEL, listed: false, run: openJump });",
    "new": "  ctx.keys.bind({ key: CHORD, label: LABEL, run: openJump });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M104",
    "guard": "the button only with the bar",
    "file": "src/enhance/jump.ts",
    "old": "  if (ctx.slots !== null) {",
    "new": "  if (true) {",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M105",
    "guard": "the button opens it",
    "file": "src/enhance/jump.ts",
    "old": "    journal.listen(btn, 'click', () => {\n      openJump();\n    });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M106",
    "guard": "the button is in the tray",
    "file": "src/enhance/jump.ts",
    "old": "    ctx.slots.tool('jump', btn);\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M107",
    "guard": "the \"/\" hint only with the keyboard",
    "file": "src/enhance/jump.ts",
    "old": "      keyboard ? [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' }), chrome(doc, 'kbd', { className: 'kb', text: '/' })] : [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' })],",
    "new": "      [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' }), chrome(doc, 'kbd', { className: 'kb', text: '/' })],",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M108",
    "guard": "the title names \"/\" only with the keyboard",
    "file": "src/enhance/jump.ts",
    "old": "title: keyboard ? `${LABEL} (/)` : LABEL,",
    "new": "title: `${LABEL} (/)`,",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M109",
    "guard": "the field controls the list",
    "file": "src/enhance/jump.ts",
    "old": "      'aria-controls': listId,\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M110",
    "guard": "the list carries its chrome id",
    "file": "src/enhance/jump.ts",
    "old": "  const list = chrome(doc, 'ul', { attrs: { role: 'listbox', id: listId, 'aria-label': 'Matches' } });",
    "new": "  const list = chrome(doc, 'ul', { attrs: { role: 'listbox', 'aria-label': 'Matches' } });",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M111",
    "guard": "the dialog is in a wrapper of its own (it covers the viewport)",
    "file": "src/enhance/jump.ts",
    "old": "  journal.insert(chrome(doc, 'div', {}, [jump]), root, null);",
    "new": "  journal.insert(jump, root, null);",
    "tests": "test/enhance-jump.test.ts test/browser/jump.test.ts"
  }
]
```

## The keys sheet: `src/enhance/keysheet.ts` (L2-T16-M112 to L2-T16-M132)

Built only with the keyboard; labelled by its heading's chrome id; the colour key; the rows read from `keys.bindings()` each time it opens, keys side by side with one label sharing a row, a space between two keys, Esc last; opening (showing it, remembering the focus, focusing Close) and closing (the focus back, or out of the hidden sheet), Close and the click outside the box, Tab held on its one control, the overlay and the "?" key, and its wrapper.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T16-M112 | keyboard: false builds no sheet | `src/enhance/keysheet.ts` | `  if (!ctx.options.keyboard) return; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "keyboard: false builds no sheet" |
| L2-T16-M113 | the heading carries the chrome id the dialog names | `src/enhance/keysheet.ts` | `chrome(doc, 'h2', { text: 'Keyboard', attrs: { id: headingId } })` → `chrome(doc, 'h2', { text: 'Keyboard' })` | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "is a closed dialog at the root's end, labelled by its heading, with the colour key"; "RF2: "?" opens the focused root's sheet; Escape closes only its own" |
| L2-T16-M114 | the colour key is in the sheet | `src/enhance/keysheet.ts` | `    ctx.text.colourKey(doc), ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "is a closed dialog at the root's end, labelled by its heading, with the colour key" |
| L2-T16-M115 | the rows are read when the sheet opens | `src/enhance/keysheet.ts` | `    opener = doc.activeElement; ⏎     fill();` → `    opener = doc.activeElement;` | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not"; "only keys next to each other share a row"; "a document with no jump still has its sheet, without "/"" |
| L2-T16-M116 | keys side by side with one label share a row | `src/enhance/keysheet.ts` | `      } else if (last !== undefined && last.label === b.label) last.keys.push(b.key); ⏎       else g…` → `      } else groups.push` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "keys next to each other with one label share a row; only keys next to each other do" (re-measured in fix round 1) |
| L2-T16-M117 | the last row is Esc | `src/enhance/keysheet.ts` | `    groups.push({ keys: [...ESCAPE_ROW.keys], label: ESCAPE_ROW.label }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not"; "only keys next to each other share a row"; "a document with no jump still has its sheet, without "/"" |
| L2-T16-M118 | a space between two keys | `src/enhance/keysheet.ts` | `        if (i > 0) keys.push(doc.createTextNode(' ')); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not" |
| L2-T16-M119 | opening shows the sheet | `src/enhance/keysheet.ts` | `    sheet.classList.add('open'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 5 failed \| 39 passed (44). ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "Close, a click outside the box and Escape close it and give the focus back; a click inside does not"; "opened with nothing focused, closing takes the focus out of the hidden sheet"; ""?" in the jump's field types, and no key opens it over a dialog"; "RF2: "?" opens the focused root's sheet; Escape closes only its own" |
| L2-T16-M120 | opening focuses Close | `src/enhance/keysheet.ts` | `    closeBtn.focus(); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 3 failed \| 41 passed (44). ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "Tab and Shift+Tab stay on its one control; other keys pass"; "opened with nothing focused, closing takes the focus out of the hidden sheet" |
| L2-T16-M121 | opening remembers the focus | `src/enhance/keysheet.ts` | `    opener = doc.activeElement; ⏎     fill();` → `    opener = null; ⏎     fill();` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "Close, a click outside the box and Escape close it and give the focus back; a click inside does not" |
| L2-T16-M122 | closing hides the sheet | `src/enhance/keysheet.ts` | `    sheet.classList.remove('open'); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). "a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not"; "Close, a click outside the box and Escape close it and give the focus back; a click inside does not"; ""?" in the jump's field types, and no key opens it over a dialog"; "RF2: "?" opens the focused root's sheet; Escape closes only its own" |
| L2-T16-M123 | closing gives the focus back | `src/enhance/keysheet.ts` | `    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "Close, a click outside the box and Escape close it and give the focus back; a click inside does not" |
| L2-T16-M124 | closing takes the focus out of the hidden sheet | `src/enhance/keysheet.ts` | `    if (now !== null && box.contains(now)) (now as HTMLElement).blur(); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "opened with nothing focused, closing takes the focus out of the hidden sheet" |
| L2-T16-M125 | only a click outside the box closes it | `src/enhance/keysheet.ts` | `    if (e.target === sheet) close();` → `    close();` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "Close, a click outside the box and Escape close it and give the focus back; a click inside does not" |
| L2-T16-M126 | Close closes it | `src/enhance/keysheet.ts` | `  journal.listen(closeBtn, 'click', () => { ⏎     close(); ⏎   }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 2 failed \| 42 passed (44). "Close, a click outside the box and Escape close it and give the focus back; a click inside does not"; "opened with nothing focused, closing takes the focus out of the hidden sheet" |
| L2-T16-M127 | only Tab is held | `src/enhance/keysheet.ts` | `    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();` → `    if (doc.activeElement === closeBtn) e.preventDefault();` | `test/enhance-jump.test.ts`: 4 failed \| 40 passed (44). "Close, a click outside the box and Escape close it and give the focus back; a click inside does not"; "Tab and Shift+Tab stay on its one control; other keys pass"; "opened with nothing focused, closing takes the focus out of the hidden sheet"; "RF2: "?" opens the focused root's sheet; Escape closes only its own" |
| L2-T16-M128 | Tab is held only on Close | `src/enhance/keysheet.ts` | `    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();` → `    if ((e as KeyboardEvent).key === 'Tab') e.preventDefault();` | `test/enhance-jump.test.ts`: 1 failed \| 43 passed (44). "Tab and Shift+Tab stay on its one control; other keys pass" |
| L2-T16-M129 | Tab and Shift+Tab stay on Close (in a browser) | `src/enhance/keysheet.ts` | `    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault(); ⏎ ` → (deleted) | `test/browser/jump.test.ts`: 1 failed \| 4 passed \| 5 skipped (10). "the keys sheet keeps the focus on its control: Tab and Shift+Tab never leave the box" |
| L2-T16-M130 | the sheet is an overlay (Escape) | `src/enhance/keysheet.ts` | `  ctx.overlays.register('keys', { isOpen, close }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 5 failed \| 39 passed (44). ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "Close, a click outside the box and Escape close it and give the focus back; a click inside does not"; "opened with nothing focused, closing takes the focus out of the hidden sheet"; ""?" in the jump's field types, and no key opens it over a dialog"; "RF2: "?" opens the focused root's sheet; Escape closes only its own" |
| L2-T16-M131 | "?" opens it | `src/enhance/keysheet.ts` | `  ctx.keys.bind({ key: '?', label: 'This sheet', run: openSheet }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 9 failed \| 35 passed (44). "is a closed dialog at the root's end, labelled by its heading, with the colour key"; ""?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close"; "a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not"; "only keys next to each other share a row"; "Close, a click outside the box and Escape close it and give the focus back; a click inside does not" (and 4 more printed) |
| L2-T16-M132 | the sheet is in a wrapper of its own (it covers the viewport) | `src/enhance/keysheet.ts` | `  journal.insert(chrome(doc, 'div', {}, [sheet]), root, null);` → `  journal.insert(sheet, root, null);` | `test/enhance-jump.test.ts`, `test/browser/jump.test.ts`: 2 failed \| 47 passed \| 5 skipped (54). "both dialogs cover the viewport at 1440×1000, not the reading column"; "is a closed dialog at the root's end, labelled by its heading, with the colour key" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T16-M112",
    "guard": "keyboard: false builds no sheet",
    "file": "src/enhance/keysheet.ts",
    "old": "  if (!ctx.options.keyboard) return;\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M113",
    "guard": "the heading carries the chrome id the dialog names",
    "file": "src/enhance/keysheet.ts",
    "old": "chrome(doc, 'h2', { text: 'Keyboard', attrs: { id: headingId } })",
    "new": "chrome(doc, 'h2', { text: 'Keyboard' })",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M114",
    "guard": "the colour key is in the sheet",
    "file": "src/enhance/keysheet.ts",
    "old": "    ctx.text.colourKey(doc),\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M115",
    "guard": "the rows are read when the sheet opens",
    "file": "src/enhance/keysheet.ts",
    "old": "    opener = doc.activeElement;\n    fill();",
    "new": "    opener = doc.activeElement;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M116",
    "guard": "keys side by side with one label share a row",
    "file": "src/enhance/keysheet.ts",
    "old": "      } else if (last !== undefined && last.label === b.label) last.keys.push(b.key);\n      else groups.push",
    "new": "      } else groups.push",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M117",
    "guard": "the last row is Esc",
    "file": "src/enhance/keysheet.ts",
    "old": "    groups.push({ keys: [...ESCAPE_ROW.keys], label: ESCAPE_ROW.label });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M118",
    "guard": "a space between two keys",
    "file": "src/enhance/keysheet.ts",
    "old": "        if (i > 0) keys.push(doc.createTextNode(' '));\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M119",
    "guard": "opening shows the sheet",
    "file": "src/enhance/keysheet.ts",
    "old": "    sheet.classList.add('open');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M120",
    "guard": "opening focuses Close",
    "file": "src/enhance/keysheet.ts",
    "old": "    closeBtn.focus();\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M121",
    "guard": "opening remembers the focus",
    "file": "src/enhance/keysheet.ts",
    "old": "    opener = doc.activeElement;\n    fill();",
    "new": "    opener = null;\n    fill();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M122",
    "guard": "closing hides the sheet",
    "file": "src/enhance/keysheet.ts",
    "old": "    sheet.classList.remove('open');\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M123",
    "guard": "closing gives the focus back",
    "file": "src/enhance/keysheet.ts",
    "old": "    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M124",
    "guard": "closing takes the focus out of the hidden sheet",
    "file": "src/enhance/keysheet.ts",
    "old": "    if (now !== null && box.contains(now)) (now as HTMLElement).blur();\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M125",
    "guard": "only a click outside the box closes it",
    "file": "src/enhance/keysheet.ts",
    "old": "    if (e.target === sheet) close();",
    "new": "    close();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M126",
    "guard": "Close closes it",
    "file": "src/enhance/keysheet.ts",
    "old": "  journal.listen(closeBtn, 'click', () => {\n    close();\n  });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M127",
    "guard": "only Tab is held",
    "file": "src/enhance/keysheet.ts",
    "old": "    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();",
    "new": "    if (doc.activeElement === closeBtn) e.preventDefault();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M128",
    "guard": "Tab is held only on Close",
    "file": "src/enhance/keysheet.ts",
    "old": "    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();",
    "new": "    if ((e as KeyboardEvent).key === 'Tab') e.preventDefault();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M129",
    "guard": "Tab and Shift+Tab stay on Close (in a browser)",
    "file": "src/enhance/keysheet.ts",
    "old": "    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();\n",
    "new": "",
    "tests": "test/browser/jump.test.ts"
  },
  {
    "id": "L2-T16-M130",
    "guard": "the sheet is an overlay (Escape)",
    "file": "src/enhance/keysheet.ts",
    "old": "  ctx.overlays.register('keys', { isOpen, close });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M131",
    "guard": "\"?\" opens it",
    "file": "src/enhance/keysheet.ts",
    "old": "  ctx.keys.bind({ key: '?', label: 'This sheet', run: openSheet });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M132",
    "guard": "the sheet is in a wrapper of its own (it covers the viewport)",
    "file": "src/enhance/keysheet.ts",
    "old": "  journal.insert(chrome(doc, 'div', {}, [sheet]), root, null);",
    "new": "  journal.insert(sheet, root, null);",
    "tests": "test/enhance-jump.test.ts test/browser/jump.test.ts"
  }
]
```
## Fix round 1: `src/enhance/jump.ts` and `src/enhance/keysheet.ts` (L2-T16-M133 to L2-T16-M155)

The guards the review found unpinned or missing: each member of the word class (a digit, a mark and `_`, before a match and as a query's first character), the section number's letter suffix, the exact 200-unit cut; going takes the focus out of the hidden dialog when the target took none; a destroy while a dialog is open closes it first; a press inside either box but off its control takes no focus; the reference's pairs ("j k", "n p") share a sheet row whatever their labels.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T16-M133 | a query opening on a digit is a word character | `src/enhance/jump.ts` | `const WORD_START = /^[\p{L}\p{M}\p{N}_]/u;` → `const WORD_START = /^[\p{L}\p{M}_]/u;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a word character is a letter, a mark, a digit or "_": before a match, and as a query's first character" |
| L2-T16-M134 | a digit before a match is a word character | `src/enhance/jump.ts` | `const WORD_END = /[\p{L}\p{M}\p{N}_]$/u;` → `const WORD_END = /[\p{L}\p{M}_]$/u;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a word character is a letter, a mark, a digit or "_": before a match, and as a query's first character" |
| L2-T16-M135 | a query opening on a mark is a word character | `src/enhance/jump.ts` | `const WORD_START = /^[\p{L}\p{M}\p{N}_]/u;` → `const WORD_START = /^[\p{L}\p{N}_]/u;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a word character is a letter, a mark, a digit or "_": before a match, and as a query's first character" |
| L2-T16-M136 | a mark before a match is a word character | `src/enhance/jump.ts` | `const WORD_END = /[\p{L}\p{M}\p{N}_]$/u;` → `const WORD_END = /[\p{L}\p{N}_]$/u;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a word character is a letter, a mark, a digit or "_": before a match, and as a query's first character" |
| L2-T16-M137 | a query opening on "_" is a word character | `src/enhance/jump.ts` | `const WORD_START = /^[\p{L}\p{M}\p{N}_]/u;` → `const WORD_START = /^[\p{L}\p{M}\p{N}]/u;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a word character is a letter, a mark, a digit or "_": before a match, and as a query's first character" |
| L2-T16-M138 | "_" before a match is a word character | `src/enhance/jump.ts` | `const WORD_END = /[\p{L}\p{M}\p{N}_]$/u;` → `const WORD_END = /[\p{L}\p{M}\p{N}]$/u;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a word character is a letter, a mark, a digit or "_": before a match, and as a query's first character" |
| L2-T16-M139 | a section number may end in a letter ("2a. ") | `src/enhance/jump.ts` | `const SECTION_NUMBER = /^[A-Z]?\d+[a-z]?\.\s+/;` → `const SECTION_NUMBER = /^[A-Z]?\d+\.\s+/;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "an h2 loses a section number with a letter after it ("2a. "), and keeps the number editorial.ts gave it" |
| L2-T16-M140 | the cut is exactly 200 code units, not fewer | `src/enhance/jump.ts` | `const TEXT_MAX = 200;` → `const TEXT_MAX = 199;` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a text of 200 code units shows whole; one of 201 is cut to exactly 200, the last the ellipsis" |
| L2-T16-M141 | going takes the focus out of the hidden dialog when the target took none | `src/enhance/jump.ts` | `    ctx.nav.goTo(x.target, { push: true }); ⏎     release(); ⏎ ` → `    ctx.nav.goTo(x.target, { push: true }); ⏎ ` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "going to a target that takes no focus (gone from the root) takes the focus out of the hidden dialog, and "/" opens it again" |
| L2-T16-M142 | closing takes the focus out of the hidden dialog (the call in close) | `src/enhance/jump.ts` | `    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true }); ⏎     release(); ⏎ ` → `    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true }); ⏎ ` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "opened with nothing focused, closing takes the focus out of the hidden dialog" |
| L2-T16-M143 | a destroy while the jump is open closes it first | `src/enhance/jump.ts` | `  journal.defer(() => { ⏎     if (isOpen()) close(); ⏎   }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a destroy while a dialog is open gives the focus back to the element that had it; one after it closed moves no focus" |
| L2-T16-M144 | a destroy closes the jump only when it is open | `src/enhance/jump.ts` | `    if (isOpen()) close();` → `    close();` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a destroy while a dialog is open gives the focus back to the element that had it; one after it closed moves no focus" |
| L2-T16-M145 | a press inside the jump's box takes no focus | `src/enhance/jump.ts` | `  journal.listen(box, 'mousedown', (e) => { ⏎     if (e.target !== input) e.preventDefault(); ⏎   })…` → (deleted) | `test/enhance-jump.test.ts`, `test/browser/jump.test.ts`: 2 failed \| 56 passed \| 6 skipped (64). "a press inside either box keeps the focus there: the sheet's Tab stays on Close, the jump's field keeps typing"; "a press inside the box keeps the focus in the field: only the field takes a press's focus" |
| L2-T16-M146 | a press on the field takes the focus | `src/enhance/jump.ts` | `    if (e.target !== input) e.preventDefault();` → `    e.preventDefault();` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a press inside the box keeps the focus in the field: only the field takes a press's focus" |
| L2-T16-M147 | a destroy while the sheet is open closes it first | `src/enhance/keysheet.ts` | `  journal.defer(() => { ⏎     if (isOpen()) close(); ⏎   }); ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a destroy while a dialog is open gives the focus back to the element that had it; one after it closed moves no focus" |
| L2-T16-M148 | a destroy closes the sheet only when it is open | `src/enhance/keysheet.ts` | `    if (isOpen()) close();` → `    close();` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a destroy while a dialog is open gives the focus back to the element that had it; one after it closed moves no focus" |
| L2-T16-M149 | a press inside the sheet's box takes no focus | `src/enhance/keysheet.ts` | `  journal.listen(box, 'mousedown', (e) => { ⏎     if ((e.target as Element).closest('button') === nu…` → (deleted) | `test/enhance-jump.test.ts`, `test/browser/jump.test.ts`: 2 failed \| 56 passed \| 6 skipped (64). "a press inside either box keeps the focus there: the sheet's Tab stays on Close, the jump's field keeps typing"; "a press inside the box keeps the focus on Close: only a button takes a press's focus" |
| L2-T16-M150 | a press on a button takes the focus | `src/enhance/keysheet.ts` | `    if ((e.target as Element).closest('button') === null) e.preventDefault();` → `    e.preventDefault();` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "a press inside the box keeps the focus on Close: only a button takes a press's focus" |
| L2-T16-M151 | "j k" is a pair | `src/enhance/keysheet.ts` | `  { first: 'j', second: 'k', label: 'Next / previous section' }, ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "the reference's pairs share a row whatever their labels: "j k" and "n p"; one of a pair alone has a row of its own" |
| L2-T16-M152 | "n p" is a pair | `src/enhance/keysheet.ts` | `  { first: 'n', second: 'p', label: 'Next / previous change' }, ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "the reference's pairs share a row whatever their labels: "j k" and "n p"; one of a pair alone has a row of its own" |
| L2-T16-M153 | a pair's row reads the pair's label | `src/enhance/keysheet.ts` | `        last.label = pair.label; ⏎ ` → (deleted) | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "the reference's pairs share a row whatever their labels: "j k" and "n p"; one of a pair alone has a row of its own" |
| L2-T16-M154 | a pair's first key is the key before | `src/enhance/keysheet.ts` | `(p) => p.first === last.keys[last.keys.length - 1] && p.second === b.key` → `(p) => p.second === b.key` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "the reference's pairs share a row whatever their labels: "j k" and "n p"; one of a pair alone has a row of its own" |
| L2-T16-M155 | a pair's second key is this one | `src/enhance/keysheet.ts` | `(p) => p.first === last.keys[last.keys.length - 1] && p.second === b.key` → `(p) => p.first === last.keys[last.keys.length - 1]` | `test/enhance-jump.test.ts`: 1 failed \| 51 passed (52). "the reference's pairs share a row whatever their labels: "j k" and "n p"; one of a pair alone has a row of its own" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T16-M133",
    "guard": "a query opening on a digit is a word character",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_START = /^[\\p{L}\\p{M}\\p{N}_]/u;",
    "new": "const WORD_START = /^[\\p{L}\\p{M}_]/u;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M134",
    "guard": "a digit before a match is a word character",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_END = /[\\p{L}\\p{M}\\p{N}_]$/u;",
    "new": "const WORD_END = /[\\p{L}\\p{M}_]$/u;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M135",
    "guard": "a query opening on a mark is a word character",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_START = /^[\\p{L}\\p{M}\\p{N}_]/u;",
    "new": "const WORD_START = /^[\\p{L}\\p{N}_]/u;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M136",
    "guard": "a mark before a match is a word character",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_END = /[\\p{L}\\p{M}\\p{N}_]$/u;",
    "new": "const WORD_END = /[\\p{L}\\p{N}_]$/u;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M137",
    "guard": "a query opening on \"_\" is a word character",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_START = /^[\\p{L}\\p{M}\\p{N}_]/u;",
    "new": "const WORD_START = /^[\\p{L}\\p{M}\\p{N}]/u;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M138",
    "guard": "\"_\" before a match is a word character",
    "file": "src/enhance/jump.ts",
    "old": "const WORD_END = /[\\p{L}\\p{M}\\p{N}_]$/u;",
    "new": "const WORD_END = /[\\p{L}\\p{M}\\p{N}]$/u;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M139",
    "guard": "a section number may end in a letter (\"2a. \")",
    "file": "src/enhance/jump.ts",
    "old": "const SECTION_NUMBER = /^[A-Z]?\\d+[a-z]?\\.\\s+/;",
    "new": "const SECTION_NUMBER = /^[A-Z]?\\d+\\.\\s+/;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M140",
    "guard": "the cut is exactly 200 code units, not fewer",
    "file": "src/enhance/jump.ts",
    "old": "const TEXT_MAX = 200;",
    "new": "const TEXT_MAX = 199;",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M141",
    "guard": "going takes the focus out of the hidden dialog when the target took none",
    "file": "src/enhance/jump.ts",
    "old": "    ctx.nav.goTo(x.target, { push: true });\n    release();\n",
    "new": "    ctx.nav.goTo(x.target, { push: true });\n",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M142",
    "guard": "closing takes the focus out of the hidden dialog (the call in close)",
    "file": "src/enhance/jump.ts",
    "old": "    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true });\n    release();\n",
    "new": "    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true });\n",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M143",
    "guard": "a destroy while the jump is open closes it first",
    "file": "src/enhance/jump.ts",
    "old": "  journal.defer(() => {\n    if (isOpen()) close();\n  });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M144",
    "guard": "a destroy closes the jump only when it is open",
    "file": "src/enhance/jump.ts",
    "old": "    if (isOpen()) close();",
    "new": "    close();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M145",
    "guard": "a press inside the jump's box takes no focus",
    "file": "src/enhance/jump.ts",
    "old": "  journal.listen(box, 'mousedown', (e) => {\n    if (e.target !== input) e.preventDefault();\n  });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts test/browser/jump.test.ts"
  },
  {
    "id": "L2-T16-M146",
    "guard": "a press on the field takes the focus",
    "file": "src/enhance/jump.ts",
    "old": "    if (e.target !== input) e.preventDefault();",
    "new": "    e.preventDefault();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M147",
    "guard": "a destroy while the sheet is open closes it first",
    "file": "src/enhance/keysheet.ts",
    "old": "  journal.defer(() => {\n    if (isOpen()) close();\n  });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M148",
    "guard": "a destroy closes the sheet only when it is open",
    "file": "src/enhance/keysheet.ts",
    "old": "    if (isOpen()) close();",
    "new": "    close();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M149",
    "guard": "a press inside the sheet's box takes no focus",
    "file": "src/enhance/keysheet.ts",
    "old": "  journal.listen(box, 'mousedown', (e) => {\n    if ((e.target as Element).closest('button') === null) e.preventDefault();\n  });\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts test/browser/jump.test.ts"
  },
  {
    "id": "L2-T16-M150",
    "guard": "a press on a button takes the focus",
    "file": "src/enhance/keysheet.ts",
    "old": "    if ((e.target as Element).closest('button') === null) e.preventDefault();",
    "new": "    e.preventDefault();",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M151",
    "guard": "\"j k\" is a pair",
    "file": "src/enhance/keysheet.ts",
    "old": "  { first: 'j', second: 'k', label: 'Next / previous section' },\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M152",
    "guard": "\"n p\" is a pair",
    "file": "src/enhance/keysheet.ts",
    "old": "  { first: 'n', second: 'p', label: 'Next / previous change' },\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M153",
    "guard": "a pair's row reads the pair's label",
    "file": "src/enhance/keysheet.ts",
    "old": "        last.label = pair.label;\n",
    "new": "",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M154",
    "guard": "a pair's first key is the key before",
    "file": "src/enhance/keysheet.ts",
    "old": "(p) => p.first === last.keys[last.keys.length - 1] && p.second === b.key",
    "new": "(p) => p.second === b.key",
    "tests": "test/enhance-jump.test.ts"
  },
  {
    "id": "L2-T16-M155",
    "guard": "a pair's second key is this one",
    "file": "src/enhance/keysheet.ts",
    "old": "(p) => p.first === last.keys[last.keys.length - 1] && p.second === b.key",
    "new": "(p) => p.first === last.keys[last.keys.length - 1]",
    "tests": "test/enhance-jump.test.ts"
  }
]
```
## Visual check

The quick jump with results and the keys sheet, light and dark, at 1440 px and at 390 px. Ours was the demo page of
`scripts/demo/samples/jump.md` (eleven headings: "In short", four numbered sections and six level-3 headings, and no
ID table, rule paragraph or figure, so both readers list the same entries); the reference was a temporary copy of the
reference reader serving the same sample from a temporary repository, on loopback. Chromium, on commit `5dda33c`.

`scripts/visual/compare.mjs`, ours on this branch against ours on `main`, in its three states at both viewports: 29
blocks in each page, 0 differences. The dialogs, their wrappers and the button move no block of the document.

The dialogs carry no `data-line`, so compare.mjs does not see them; a scratch script measured them the same way, in
the four combinations: the jump opened by "/" (the empty query), then "ing" typed and the arrow pressed once, then the
keys sheet opened by "?". Per element, its box (to 0.1 px) and its computed values (display, position, the font,
line height, letter spacing, text transform, colour, background, padding, margins, borders, radius, shadow, white
space, overflow, max height, min width, z-index, list style, gap, grid columns) and its visible text: the jump's
backdrop, box, field, hint and list, every row and its spans; the button and its two spans; the sheet's backdrop,
box, head, heading, Close, list, every row's term, key and label, the colour key's heading, list, items and swatches.

- **The entries match.** Both readers list the same eleven headings, in the same order and with the same numbers,
  for the empty query, and the same seven for "ing", in the same order, the second selected.
- **The jump: one unexpected difference.** Each row's bottom margin is 6.525 px against 4.35 px, so the list and the
  box grow by the sum: the root's reading-column rule for `li` (.45em) reaches the dialog's rows, where the
  reference's dialog, outside its reading column, took the base rule (.3em). Every other value and box, the field,
  the hint and each row's spans included, matches to 0.1 px, and the backdrop covers the viewport in both.
- **The keys sheet: three unexpected differences, the same cause.** Its two headings take the reading column's `h2`
  rule (`position: relative`, line height 13.42 px against 14.3 px); the colour key takes its `ul` rule (left padding
  17.5 px, bottom margin 13.75 px) and its items the `li` rule (bottom margin 5.625 px), so the items are narrower
  (by 8.75 px each in the two columns at 1440 px, where four labels wrap, and by 17.5 px in the one at 390 px).
- **Expected.** The button's place: the bar is unplaced until Task 12 (LD10); its size and inner boxes match. The
  sheet's rows: "j k" and "m" are absent until Tasks 14 and 18 bind those keys, so the key column is 28 px wide
  (41.38 px with "j k") and the box shorter. "j k" shares one row, "Next / previous section", once Task 14 binds both
  keys, whatever labels it gives them: since fix round 1 the sheet pairs "j k" and "n p" itself (keysheet.ts's
  `PAIRS`), and Task 14's branch labels them "Next section" and "Previous section". The colour key's ID example reads
  "IDs: R14, F3, …" (C48).
- **Not compared: ID and figure rows (carried).** The sample has no ID table, rule paragraph or figure, because the
  index (Task 9) and the figures (Task 15) were not on `main`, so this side would list none. So an ID row's `.lvl.id`
  (the monospaced, ID-coloured tag) and `.jk` (its kind, cut with an ellipsis at 11em), and a figure row's "Fig N"
  tag, were never set beside the reference's. Carried: compare a query that lists ID and figure rows once Tasks 9 and
  15 are below this branch, or in Task 24's parity pass.
- **The fix is the stylesheet's** (`assets/reader.css`, not this task's file; the PR names it as an open point). With
  these four rules added to a scratch copy of the demo's stylesheet, the jump has 0 differences in all four
  combinations and the sheet only the expected ones:

  ```css
  [data-docreader-root][data-docreader-root][data-docreader-root] .jump li { margin-bottom: .3em; }
  [data-docreader-root][data-docreader-root][data-docreader-root] .keys h2 { position: static; line-height: 1.3; }
  [data-docreader-root][data-docreader-root][data-docreader-root] .ckey { padding: 0; margin: 0; }
  [data-docreader-root][data-docreader-root][data-docreader-root] .ckey li { margin: 0; }
  ```

## The coordinator's commit at rebase: the dialogs' resets (L2-T16-M156 to L2-T16-M159)

The visual check measured four differences that come from the stylesheet: the reading column's prose rules reach the
dialogs, which live in the root, where the reference kept its dialogs outside its column. `assets/reader.css` is not
this task's file, so the coordinator added the four measured resets at rebase (C54), beside the dialogs' own rules,
with a browser case that reads each computed value. Measured 2026-10-20 on `l2-t16-jump`, rebased onto `main`, with
the change uncommitted, by `mutate.mjs` on throwaway copies in Chromium; the checkout's status was the same before and
after.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T16-M156 | the jump's rows keep the reference's row spacing, not the column's | `assets/reader.css` | the rule `.jump li { margin-bottom: .3em; }` deleted | `test/browser/jump.test.ts` (Chromium): 1 failed \| 13 skipped (14). "the reading column's prose rules stop at the dialogs: the jump's rows, the sheet's headings and the colour key" |
| L2-T16-M157 | the sheet's headings take neither the column's position nor its line height | `assets/reader.css` | the rule `.keys h2 { position: static; line-height: 1.3; }` deleted | `test/browser/jump.test.ts` (Chromium): 1 failed \| 13 skipped (14). "the reading column's prose rules stop at the dialogs: the jump's rows, the sheet's headings and the colour key" |
| L2-T16-M158 | the colour key takes no list padding or margin | `assets/reader.css` | the rule `.ckey { padding: 0; margin: 0; }` deleted | `test/browser/jump.test.ts` (Chromium): 1 failed \| 13 skipped (14). "the reading column's prose rules stop at the dialogs: the jump's rows, the sheet's headings and the colour key" |
| L2-T16-M159 | the colour key's items take no list-item margin | `assets/reader.css` | the rule `.ckey li { margin: 0; }` deleted | `test/browser/jump.test.ts` (Chromium): 1 failed \| 13 skipped (14). "the reading column's prose rules stop at the dialogs: the jump's rows, the sheet's headings and the colour key" |

```json
[
  {
    "id": "L2-T16-M156",
    "guard": "the jump's rows keep the reference's row spacing, not the column's",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-root] .jump li { margin-bottom: .3em; }\n",
    "new": "",
    "tests": "--project layout test/browser/jump.test.ts -t \"prose rules stop\""
  },
  {
    "id": "L2-T16-M157",
    "guard": "the sheet's headings take neither the column's position nor its line height",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-root] .keys h2 { position: static; line-height: 1.3; }\n",
    "new": "",
    "tests": "--project layout test/browser/jump.test.ts -t \"prose rules stop\""
  },
  {
    "id": "L2-T16-M158",
    "guard": "the colour key takes no list padding or margin",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-root] .ckey { padding: 0; margin: 0; }\n",
    "new": "",
    "tests": "--project layout test/browser/jump.test.ts -t \"prose rules stop\""
  },
  {
    "id": "L2-T16-M159",
    "guard": "the colour key's items take no list-item margin",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-root] .ckey li { margin: 0; }\n",
    "new": "",
    "tests": "--project layout test/browser/jump.test.ts -t \"prose rules stop\""
  }
]
```
