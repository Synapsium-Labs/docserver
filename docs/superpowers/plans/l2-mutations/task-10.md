# L2 Task 10: mutation rows (tables and code blocks)

Each guard of Task 10, deleted or inverted once, with the tests that go red: the bullet cells, the filter and the
table measures (`src/enhance/tables.ts`), the Copy buttons and the code widths (`src/enhance/code.ts`), and the
stylesheet's column against the code (`assets/reader.css`). Measured 2026-10-20 on branch `l2-t10-blocks`, on commit
`9351c3d` (after main's #22 and #23 were merged in), every row, L2-T10-M1 to L2-T10-M118: all 118 measured red
(`rc=1`), none green, none reported. A first pass on `0355e95`, before that merge, gave the same verdicts.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a 512 MiB
output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict). Each row is
applied to its own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules`
linked from the checkout), its tests run there with the local `vitest`, and the copy is deleted. Each `old` occurs
exactly once in its file. Most rows run `test/enhance-blocks.test.ts` (48 cases); seven run a browser file beside it
(`test/browser/blocks.test.ts`, or the Level 2 runner `test/browser/layout-corpus.test.ts` for the cases in
`conformance/layout/blocks/`), so a browser case is seen to bite as well. Every row ran with
`DOCREADER_BROWSERS=chromium`: no guard of this task is WebKit's alone, so no row runs in the Playwright image; the
browser cases themselves are green in both browsers (the PR says how). The rows ran one at a time, in six batches of at
most 20. The checkout was never edited: `git status --porcelain` read the same (empty) before and after, and so did
`HEAD` and the hash of `git diff`. The Red column gives the count line and the failing tests the run printed (at most
five here, with the number of others printed; the run prints at most 20 failing lines). Every count line adds up to
its total.

Notes on the measurement.
- The numbers the code widths are reckoned with are not exported (C49: a feature module exports `build` alone). The
  cases read the stylesheet's own (`--measure` for each width and face, `--rem`, `--wide`, `--mono`, the code's
  size, the phone's query) from `assets/reader.css` and hold the widths to them through enhance(); a case first pins
  what it read. So a number moved in the code (L2-T10-M48, M80, M84 to M86, M90, M91 and M109 to M111) and the
  column moved in the stylesheet (L2-T10-M118) both go red. The reference's own numbers (1400 ms, 36 line breaks, 12
  rows, 48 px, 42 px, 7.5 px, 8 characters, 1240 px) are written in the cases as numbers.
- The label timer has no row of its own: it is `env.timeout`'s, which destroy cancels (Task 7a). No other way to time
  it passes the walls, and the case "destroy clears the label timer" pins that it is cancelled.
- Six checks were removed before these rows, since no case could redden them (C49): that the bullet cells read only
  `td` cells (the body rows render() writes hold no other), the two early returns for a document with no table or no
  code block, a floor of 0 under the room (a negative room decides as 0 does, since a line needs at least 42 px), a
  write of `long` only when it changes, and the revealer's registration only when a table has a filter (neither of
  the last two changes an outcome).
- The case "on a phone the filter hides the rows of a table that stacks into cards" is marked `fails`: it records
  the open point the PR reports (the stylesheet's `.stack tr { display: block }` beats the browser's `[hidden]`), and
  no row depends on it.

## Bullet cells: `src/enhance/tables.ts` (L2-T10-M1 to L2-T10-M15)

A body cell split by `<br>` becomes its lines: a run holding an element or text that is not white space is a line, the rest joins the line before it (the first takes what comes before it); each `<br>` is wrapped in a hidden chrome span; a line that opens on one of four bullets, then white space, takes `.b`, and its bullet is split off (only when it is not the whole text) into a hidden chrome span the status marks read past.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T10-M1 | bullet cells: built for every body cell | `src/enhance/tables.ts` | `  for (const t of tables) for (const r of t.rows) for (const c of Array.from(r.cells)) cellLines(ctx…` → (deleted) | `test/enhance-blocks.test.ts`: 7 failed \| 41 passed (48). "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children"; "a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text"; "a bullet that is its whole text node is hidden whole, with nothing split off"; "a cell of breaks and white space only gets no line, and its breaks are hidden" (and 2 more printed) |
| L2-T10-M2 | bullet cells: a cell with no `<br>` is left alone | `src/enhance/tables.ts` | `  if (!kids.some(isBr)) return; ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "a cell with no `<br>`, and a header cell with one, are left alone"; "a bullet that is its whole text node is hidden whole, with nothing split off" |
| L2-T10-M3 | bullet cells: a `<br>` is an element named br | `src/enhance/tables.ts` | `(n as Element).localName === 'br'` → `(n as Element).localName === 'wbr'` | `test/enhance-blocks.test.ts`: 7 failed \| 41 passed (48). "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children"; "a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text"; "a bullet that is its whole text node is hidden whole, with nothing split off"; "a cell of breaks and white space only gets no line, and its breaks are hidden" (and 2 more printed) |
| L2-T10-M4 | bullet cells: a run holding an element with no text is a line | `src/enhance/tables.ts` | `run.some((n) => n.nodeType === 1 \|\| (n.textContent ?? '').trim() !== '')` → `run.some((n) => (n.textContent ?? '').trim() !== '')` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children" |
| L2-T10-M5 | bullet cells: a run of white space only is no line | `src/enhance/tables.ts` | `(n.textContent ?? '').trim() !== '')` → `(n.textContent ?? '') !== '')` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children"; "a cell of breaks and white space only gets no line, and its breaks are hidden" |
| L2-T10-M6 | bullet cells: each `<br>` is wrapped in a span | `src/enhance/tables.ts` | `    if (isBr(n)) journal.wrap([n], chrome(doc, 'span', { className: 'cell-br', attrs: { hidden: '' }…` → (deleted) | `test/enhance-blocks.test.ts`, `test/browser/blocks.test.ts`: 5 failed \| 51 passed \| 1 expected fail \| 9 skipped (66). "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children"; "a cell of breaks and white space only gets no line, and its breaks are hidden"; "the status marks read the first line past its hidden bullet and breaks, as the reference read the stripped line"; "a bullet cell's lines are blocks, the second 0.5em below the first; its bullet and its breaks take no box" |
| L2-T10-M7 | bullet cells: the `<br>`'s span is hidden | `src/enhance/tables.ts` | `{ className: 'cell-br', attrs: { hidden: '' } }` → `{ className: 'cell-br' }` | `test/browser/blocks.test.ts`, `test/enhance-blocks.test.ts`: 5 failed \| 51 passed \| 1 expected fail \| 9 skipped (66). "a bullet cell's lines are blocks, the second 0.5em below the first; its bullet and its breaks take no box"; "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children"; "a cell of breaks and white space only gets no line, and its breaks are hidden"; "the status marks read the first line past its hidden bullet and breaks, as the reference read the stripped line" |
| L2-T10-M8 | bullet cells: a bullet is one of four characters, the dash among them | `src/enhance/tables.ts` | `const BULLET = /^\s*[•·▪-]\s+/;` → `const BULLET = /^\s*[•·▪]\s+/;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text" |
| L2-T10-M9 | bullet cells: a bullet needs white space after it | `src/enhance/tables.ts` | `const BULLET = /^\s*[•·▪-]\s+/;` → `const BULLET = /^\s*[•·▪-]\s*/;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text" |
| L2-T10-M10 | bullet cells: a bullet that is not the whole text is split off | `src/enhance/tables.ts` | `    if (m[0].length < text.data.length) journal.split(text, m[0].length); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text"; "the status marks read the first line past its hidden bullet and breaks, as the reference read the stripped line" |
| L2-T10-M11 | bullet cells: a bullet that is the whole text is not split | `src/enhance/tables.ts` | `    if (m[0].length < text.data.length) journal.split(text, m[0].length);` → `    journal.split(text, m[0].length);` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a bullet that is its whole text node is hidden whole, with nothing split off" |
| L2-T10-M12 | bullet cells: the bullet's span is hidden (and the marks read past it) | `src/enhance/tables.ts` | `{ className: 'cell-bullet', attrs: { hidden: '' } }` → `{ className: 'cell-bullet' }` | `test/enhance-blocks.test.ts`, `test/browser/blocks.test.ts`: 4 failed \| 52 passed \| 1 expected fail \| 9 skipped (66). "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "a bullet that is its whole text node is hidden whole, with nothing split off"; "the status marks read the first line past its hidden bullet and breaks, as the reference read the stripped line"; "a bullet cell's lines are blocks, the second 0.5em below the first; its bullet and its breaks take no box" |
| L2-T10-M13 | bullet cells: a bullet line takes .b | `src/enhance/tables.ts` | `bullets[j] === true ? 'cell-line b' : 'cell-line'` → `'cell-line'` | `test/browser/layout-corpus.test.ts`, `test/enhance-blocks.test.ts`: 5 failed \| 60 passed \| 12 skipped (77). "blocks/bullets"; "blocks/hostile-cells"; "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text"; "a bullet that is its whole text node is hidden whole, with nothing split off" |
| L2-T10-M14 | bullet cells: the first line starts at the first node of the cell | `src/enhance/tables.ts` | `    const from = j === 0 ? td.firstChild : starts[j];` → `    const from = starts[j];` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children"; "the status marks read the first line past its hidden bullet and breaks, as the reference read the stripped line" |
| L2-T10-M15 | bullet cells: a line stops where the next starts | `src/enhance/tables.ts` | `    const stop = starts[j + 1] ?? null;` → `    const stop = null;` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each `<br>` stays, hidden"; "lines with no bullet take no .b; a `<br>` with nothing after it, or before, joins a line; only lines are children" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T10-M1",
    "file": "src/enhance/tables.ts",
    "old": "  for (const t of tables) for (const r of t.rows) for (const c of Array.from(r.cells)) cellLines(ctx.journal, doc, c);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M2",
    "file": "src/enhance/tables.ts",
    "old": "  if (!kids.some(isBr)) return;\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M3",
    "file": "src/enhance/tables.ts",
    "old": "(n as Element).localName === 'br'",
    "new": "(n as Element).localName === 'wbr'",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M4",
    "file": "src/enhance/tables.ts",
    "old": "run.some((n) => n.nodeType === 1 || (n.textContent ?? '').trim() !== '')",
    "new": "run.some((n) => (n.textContent ?? '').trim() !== '')",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M5",
    "file": "src/enhance/tables.ts",
    "old": "(n.textContent ?? '').trim() !== '')",
    "new": "(n.textContent ?? '') !== '')",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M6",
    "file": "src/enhance/tables.ts",
    "old": "    if (isBr(n)) journal.wrap([n], chrome(doc, 'span', { className: 'cell-br', attrs: { hidden: '' } }));\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts test/browser/blocks.test.ts"
  },
  {
    "id": "L2-T10-M7",
    "file": "src/enhance/tables.ts",
    "old": "{ className: 'cell-br', attrs: { hidden: '' } }",
    "new": "{ className: 'cell-br' }",
    "tests": "test/enhance-blocks.test.ts test/browser/blocks.test.ts"
  },
  {
    "id": "L2-T10-M8",
    "file": "src/enhance/tables.ts",
    "old": "const BULLET = /^\\s*[•·▪-]\\s+/;",
    "new": "const BULLET = /^\\s*[•·▪]\\s+/;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M9",
    "file": "src/enhance/tables.ts",
    "old": "const BULLET = /^\\s*[•·▪-]\\s+/;",
    "new": "const BULLET = /^\\s*[•·▪-]\\s*/;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M10",
    "file": "src/enhance/tables.ts",
    "old": "    if (m[0].length < text.data.length) journal.split(text, m[0].length);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M11",
    "file": "src/enhance/tables.ts",
    "old": "    if (m[0].length < text.data.length) journal.split(text, m[0].length);",
    "new": "    journal.split(text, m[0].length);",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M12",
    "file": "src/enhance/tables.ts",
    "old": "{ className: 'cell-bullet', attrs: { hidden: '' } }",
    "new": "{ className: 'cell-bullet' }",
    "tests": "test/enhance-blocks.test.ts test/browser/blocks.test.ts"
  },
  {
    "id": "L2-T10-M13",
    "file": "src/enhance/tables.ts",
    "old": "bullets[j] === true ? 'cell-line b' : 'cell-line'",
    "new": "'cell-line'",
    "tests": "test/enhance-blocks.test.ts test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T10-M14",
    "file": "src/enhance/tables.ts",
    "old": "    const from = j === 0 ? td.firstChild : starts[j];",
    "new": "    const from = starts[j];",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M15",
    "file": "src/enhance/tables.ts",
    "old": "    const stop = starts[j + 1] ?? null;",
    "new": "    const stop = null;",
    "tests": "test/enhance-blocks.test.ts"
  }
]
```

## The filter: `src/enhance/tables.ts` (L2-T10-M16 to L2-T10-M38)

From 12 rows; its field, count and block (`cols-2` for two columns), the tools before the table; the field as `blocks[].filter`; what is typed, trimmed and in any case, against each row's text in any case; a row hidden through the journal, only the rows it hid shown again and a row whose `hidden` the host changed left as the host set it; the count; the input listener; and reveal, which clears the filter for a row it hides and only for one.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T10-M16 | filter: from 12 rows | `src/enhance/tables.ts` | `const FILTER_MIN_ROWS = 12;` → `const FILTER_MIN_ROWS = 13;` | `test/enhance-blocks.test.ts`: 5 failed \| 43 passed (48). "a table of 12 rows or more gets one; one of 11 does not"; "a table of two columns gives its block cols-2"; "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show"; "it shows again only the rows it hid: a row hidden by someone else stays hidden"; "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |
| L2-T10-M17 | filter: 12 rows or more | `src/enhance/tables.ts` | `if (t.rows.length >= FILTER_MIN_ROWS)` → `if (t.rows.length > FILTER_MIN_ROWS)` | `test/enhance-blocks.test.ts`: 5 failed \| 43 passed (48). "a table of 12 rows or more gets one; one of 11 does not"; "a table of two columns gives its block cols-2"; "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show"; "it shows again only the rows it hid: a row hidden by someone else stays hidden"; "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |
| L2-T10-M18 | filter: the field is a search field | `src/enhance/tables.ts` | `{ type: 'search', placeholder:` → `{ type: 'text', placeholder:` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the block holds the tools, then the table; the tools hold a live count, then a search field labelled with the count of rows" |
| L2-T10-M19 | filter: the placeholder counts the rows | `src/enhance/tables.ts` | `placeholder: `Filter ${String(n)} rows`` → `placeholder: 'Filter rows'` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the block holds the tools, then the table; the tools hold a live count, then a search field labelled with the count of rows" |
| L2-T10-M20 | filter: the label counts the rows | `src/enhance/tables.ts` | `'aria-label': `Filter this table's ${String(n)} rows`` → `'aria-label': 'Filter'` | `test/browser/layout-corpus.test.ts`, `test/enhance-blocks.test.ts`: 2 failed \| 63 passed \| 12 skipped (77). "blocks/filter"; "the block holds the tools, then the table; the tools hold a live count, then a search field labelled with the count of rows" |
| L2-T10-M21 | filter: the count is a live region | `src/enhance/tables.ts` | `chrome(doc, 'span', { attrs: { 'aria-live': 'polite' } })` → `chrome(doc, 'span')` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the block holds the tools, then the table; the tools hold a live count, then a search field labelled with the count of rows" |
| L2-T10-M22 | filter: the block of a two-column table takes cols-2 | `src/enhance/tables.ts` | `t.heads.length === 2 ? 'tbl-block cols-2' : 'tbl-block'` → `'tbl-block'` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a table of two columns gives its block cols-2" |
| L2-T10-M23 | filter: the tools come before the table | `src/enhance/tables.ts` | `block, t.el);` → `block, null);` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the block holds the tools, then the table; the tools hold a live count, then a search field labelled with the count of rows" |
| L2-T10-M24 | filter: the field is the table's blocks[].filter | `src/enhance/tables.ts` | `  t.filter = input; ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a table of 12 rows or more gets one; one of 11 does not" |
| L2-T10-M25 | filter: what is typed is trimmed | `src/enhance/tables.ts` | `input.value.trim().toLowerCase()` → `input.value.toLowerCase()` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show" |
| L2-T10-M26 | filter: what is typed is matched in any case | `src/enhance/tables.ts` | `input.value.trim().toLowerCase()` → `input.value.trim()` | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show"; "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing"; "destroy restores the table byte for byte, with rows hidden by the filter, and the field does nothing after" |
| L2-T10-M27 | filter: the row's text is matched in any case | `src/enhance/tables.ts` | `(r.textContent ?? '').toLowerCase().includes(q)` → `(r.textContent ?? '').includes(q)` | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show"; "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing"; "destroy restores the table byte for byte, with rows hidden by the filter, and the field does nothing after" |
| L2-T10-M28 | filter: a row is hidden through the journal | `src/enhance/tables.ts` | `        journal.setAttribute(r, 'hidden', '');` → `        r.setAttribute('hidden', '');` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "destroy restores the table byte for byte, with rows hidden by the filter, and the field does nothing after" |
| L2-T10-M29 | filter: only the rows it hid are shown again | `src/enhance/tables.ts` | `        if (hid.delete(r)) {` → `        if ((hid.delete(r), true)) {` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "it shows again only the rows it hid: a row hidden by someone else stays hidden" |
| L2-T10-M30 | filter: a row whose hidden the host changed since keeps the host's | `src/enhance/tables.ts` | `          if (r.getAttribute('hidden') === '') journal.setAttribute(r, 'hidden', null);` → `          journal.setAttribute(r, 'hidden', null);` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "it shows again only the rows it hid: a row hidden by someone else stays hidden" |
| L2-T10-M31 | filter: a row hidden already is not taken over | `src/enhance/tables.ts` | `      } else if (!r.hasAttribute('hidden')) {` → `      } else {` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "it shows again only the rows it hid: a row hidden by someone else stays hidden" |
| L2-T10-M32 | filter: the count reads "<shown> of <rows>" | `src/enhance/tables.ts` | ``${String(shown)} of ${String(n)}`` → ``${String(shown)}`` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show" |
| L2-T10-M33 | filter: the count is empty with nothing typed | `src/enhance/tables.ts` | `count.textContent = q === '' ? '' : ` → `count.textContent = ` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show"; "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |
| L2-T10-M34 | filter: it follows each input | `src/enhance/tables.ts` | `journal.listen(input, 'input', apply);` → `journal.listen(input, 'change', apply);` | `test/browser/blocks.test.ts`, `test/enhance-blocks.test.ts`: 4 failed \| 52 passed \| 1 expected fail \| 9 skipped (66). "the filter hides the rows without what is typed; clearing it shows them again"; "what is typed, trimmed and in any case, hides the rows without it, and the count says how many show"; "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing"; "destroy restores the table byte for byte, with rows hidden by the filter, and the field does nothing after" |
| L2-T10-M35 | filter: reveal clears it | `src/enhance/tables.ts` | `    if (tr !== null) hiddenBy.get(tr)?.();` → `    void tr;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |
| L2-T10-M36 | filter: clearing empties the field | `src/enhance/tables.ts` | `    input.value = ''; ⏎     apply();` → `    apply();` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |
| L2-T10-M37 | filter: a row shown again is no longer one it hides | `src/enhance/tables.ts` | `          hiddenBy.delete(r); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |
| L2-T10-M38 | filter: a row it hides is one reveal clears it for | `src/enhance/tables.ts` | `        hiddenBy.set(r, clear); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T10-M16",
    "file": "src/enhance/tables.ts",
    "old": "const FILTER_MIN_ROWS = 12;",
    "new": "const FILTER_MIN_ROWS = 13;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M17",
    "file": "src/enhance/tables.ts",
    "old": "if (t.rows.length >= FILTER_MIN_ROWS)",
    "new": "if (t.rows.length > FILTER_MIN_ROWS)",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M18",
    "file": "src/enhance/tables.ts",
    "old": "{ type: 'search', placeholder:",
    "new": "{ type: 'text', placeholder:",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M19",
    "file": "src/enhance/tables.ts",
    "old": "placeholder: `Filter ${String(n)} rows`",
    "new": "placeholder: 'Filter rows'",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M20",
    "file": "src/enhance/tables.ts",
    "old": "'aria-label': `Filter this table's ${String(n)} rows`",
    "new": "'aria-label': 'Filter'",
    "tests": "test/enhance-blocks.test.ts test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T10-M21",
    "file": "src/enhance/tables.ts",
    "old": "chrome(doc, 'span', { attrs: { 'aria-live': 'polite' } })",
    "new": "chrome(doc, 'span')",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M22",
    "file": "src/enhance/tables.ts",
    "old": "t.heads.length === 2 ? 'tbl-block cols-2' : 'tbl-block'",
    "new": "'tbl-block'",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M23",
    "file": "src/enhance/tables.ts",
    "old": "block, t.el);",
    "new": "block, null);",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M24",
    "file": "src/enhance/tables.ts",
    "old": "  t.filter = input;\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M25",
    "file": "src/enhance/tables.ts",
    "old": "input.value.trim().toLowerCase()",
    "new": "input.value.toLowerCase()",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M26",
    "file": "src/enhance/tables.ts",
    "old": "input.value.trim().toLowerCase()",
    "new": "input.value.trim()",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M27",
    "file": "src/enhance/tables.ts",
    "old": "(r.textContent ?? '').toLowerCase().includes(q)",
    "new": "(r.textContent ?? '').includes(q)",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M28",
    "file": "src/enhance/tables.ts",
    "old": "        journal.setAttribute(r, 'hidden', '');",
    "new": "        r.setAttribute('hidden', '');",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M29",
    "file": "src/enhance/tables.ts",
    "old": "        if (hid.delete(r)) {",
    "new": "        if ((hid.delete(r), true)) {",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M30",
    "file": "src/enhance/tables.ts",
    "old": "          if (r.getAttribute('hidden') === '') journal.setAttribute(r, 'hidden', null);",
    "new": "          journal.setAttribute(r, 'hidden', null);",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M31",
    "file": "src/enhance/tables.ts",
    "old": "      } else if (!r.hasAttribute('hidden')) {",
    "new": "      } else {",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M32",
    "file": "src/enhance/tables.ts",
    "old": "`${String(shown)} of ${String(n)}`",
    "new": "`${String(shown)}`",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M33",
    "file": "src/enhance/tables.ts",
    "old": "count.textContent = q === '' ? '' : ",
    "new": "count.textContent = ",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M34",
    "file": "src/enhance/tables.ts",
    "old": "journal.listen(input, 'input', apply);",
    "new": "journal.listen(input, 'change', apply);",
    "tests": "test/enhance-blocks.test.ts test/browser/blocks.test.ts"
  },
  {
    "id": "L2-T10-M35",
    "file": "src/enhance/tables.ts",
    "old": "    if (tr !== null) hiddenBy.get(tr)?.();",
    "new": "    void tr;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M36",
    "file": "src/enhance/tables.ts",
    "old": "    input.value = '';\n    apply();",
    "new": "    apply();",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M37",
    "file": "src/enhance/tables.ts",
    "old": "          hiddenBy.delete(r);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M38",
    "file": "src/enhance/tables.ts",
    "old": "        hiddenBy.set(r, clear);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  }
]
```

## Table measures: `src/enhance/tables.ts` (L2-T10-M39 to L2-T10-M55)

On every relayout: `fits` dropped before the read, the plus 1, `--thead-h` (0px with no head), the region (not for a stacked table on a phone of 700 px or less), its tab stop, role and label, and its removal, only of a region it made.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T10-M39 | measure: on every relayout | `src/enhance/tables.ts` | `    measure(ctx, tables); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 6 failed \| 42 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region"; "fits is dropped before the sizes are read, so the read sees the table without it"; "on a phone (700 px or less) a table that stacks into cards is no region, and one of two columns is"; "the label counts every table of the document and names the first three headers"; "a table with no head is labelled by its number alone, and its --thead-h is 0px" (and 1 more printed) |
| L2-T10-M40 | measure: fits drops before the sizes are read | `src/enhance/tables.ts` | `  for (const t of tables) if (t.el.classList.contains('fits')) journal.toggleClass(t.el, 'fits', fal…` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "fits is dropped before the sizes are read, so the read sees the table without it" |
| L2-T10-M41 | measure: fits allows the wrapper's width plus 1 | `src/enhance/tables.ts` | `t.el.clientWidth + 1,` → `t.el.clientWidth,` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region" |
| L2-T10-M42 | measure: fits when no wider | `src/enhance/tables.ts` | `t.table.scrollWidth <= t.el.clientWidth` → `t.table.scrollWidth < t.el.clientWidth` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region" |
| L2-T10-M43 | measure: --thead-h is the head's height | `src/enhance/tables.ts` | ``${String(headH)}px`` → `'40px'` | `test/browser/blocks.test.ts`, `test/enhance-blocks.test.ts`: 6 failed \| 50 passed \| 1 expected fail \| 9 skipped (66). "a table that fits takes fits and is no region; one that does not is a labelled region; --thead-h is its head height"; "a table that stacks on a phone is no region at 700 px and is one at 701; one of two columns that overflows is one on a phone too"; "a width change measures again: long, the regions, fits and --thead-h follow the viewport"; "with the fonts held back, --thead-h and long are measured again once they load"; "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region" (and 1 more printed) |
| L2-T10-M44 | measure: no head, 0px | `src/enhance/tables.ts` | `t.table.tHead?.offsetHeight ?? 0` → `t.table.tHead?.offsetHeight ?? 1` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a table with no head is labelled by its number alone, and its --thead-h is 0px" |
| L2-T10-M45 | measure: a stacked table is no region on a phone | `src/enhance/tables.ts` | `return !fits && (!stack \|\| !phone);` → `return !fits;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "on a phone (700 px or less) a table that stacks into cards is no region, and one of two columns is" |
| L2-T10-M46 | measure: a stacked table is a region off a phone | `src/enhance/tables.ts` | `return !fits && (!stack \|\| !phone);` → `return !fits && !stack;` | `test/enhance-blocks.test.ts`: 4 failed \| 44 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region"; "on a phone (700 px or less) a table that stacks into cards is no region, and one of two columns is"; "the label counts every table of the document and names the first three headers"; "destroy takes fits, --thead-h and the region away again" |
| L2-T10-M47 | measure: the phone is 700 px or less | `src/enhance/tables.ts` | `ctx.env.viewport().w <= PHONE_MAX_W` → `ctx.env.viewport().w < PHONE_MAX_W` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "on a phone (700 px or less) a table that stacks into cards is no region, and one of two columns is" |
| L2-T10-M48 | measure: the phone's width is the stylesheet's | `src/enhance/tables.ts` | `const PHONE_MAX_W = 700;` → `const PHONE_MAX_W = 699;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "on a phone (700 px or less) a table that stacks into cards is no region, and one of two columns is" |
| L2-T10-M49 | measure: the region is in the tab order | `src/enhance/tables.ts` | `      journal.setAttribute(t.el, 'tabindex', '0'); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region" |
| L2-T10-M50 | measure: the region has its role | `src/enhance/tables.ts` | `      journal.setAttribute(t.el, 'role', 'region'); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region"; "on a phone (700 px or less) a table that stacks into cards is no region, and one of two columns is"; "destroy takes fits, --thead-h and the region away again" |
| L2-T10-M51 | measure: the region's label counts the tables from 1 | `src/enhance/tables.ts` | ``Table ${String(i + 1)}, scrolls sideways${heads}`` → ``Table ${String(i)}, scrolls sideways${heads}`` | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region"; "the label counts every table of the document and names the first three headers"; "a table with no head is labelled by its number alone, and its --thead-h is 0px" |
| L2-T10-M52 | measure: the region's label names three headers | `src/enhance/tables.ts` | `t.heads.slice(0, 3)` → `t.heads.slice(0, 4)` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the label counts every table of the document and names the first three headers" |
| L2-T10-M53 | measure: no headers, no colon | `src/enhance/tables.ts` | `t.heads.length > 0 ? `: ${t.heads.slice(0, 3).join(', ')}` : ''` → ``: ${t.heads.slice(0, 3).join(', ')}`` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a table with no head is labelled by its number alone, and its --thead-h is 0px" |
| L2-T10-M54 | measure: a table that fits again loses the region | `src/enhance/tables.ts` | `    } else if (t.el.getAttribute('role') === 'region') {` → `    } else if (false) {` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "fits, --thead-h and the region come from the sizes read; a table that fits again loses the region" |
| L2-T10-M55 | measure: a role the host gave stays | `src/enhance/tables.ts` | `    } else if (t.el.getAttribute('role') === 'region') {` → `    } else {` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a role the host gave a wrapper that fits is the host's: it stays" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T10-M39",
    "file": "src/enhance/tables.ts",
    "old": "    measure(ctx, tables);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M40",
    "file": "src/enhance/tables.ts",
    "old": "  for (const t of tables) if (t.el.classList.contains('fits')) journal.toggleClass(t.el, 'fits', false);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M41",
    "file": "src/enhance/tables.ts",
    "old": "t.el.clientWidth + 1,",
    "new": "t.el.clientWidth,",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M42",
    "file": "src/enhance/tables.ts",
    "old": "t.table.scrollWidth <= t.el.clientWidth",
    "new": "t.table.scrollWidth < t.el.clientWidth",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M43",
    "file": "src/enhance/tables.ts",
    "old": "`${String(headH)}px`",
    "new": "'40px'",
    "tests": "test/enhance-blocks.test.ts test/browser/blocks.test.ts"
  },
  {
    "id": "L2-T10-M44",
    "file": "src/enhance/tables.ts",
    "old": "t.table.tHead?.offsetHeight ?? 0",
    "new": "t.table.tHead?.offsetHeight ?? 1",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M45",
    "file": "src/enhance/tables.ts",
    "old": "return !fits && (!stack || !phone);",
    "new": "return !fits;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M46",
    "file": "src/enhance/tables.ts",
    "old": "return !fits && (!stack || !phone);",
    "new": "return !fits && !stack;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M47",
    "file": "src/enhance/tables.ts",
    "old": "ctx.env.viewport().w <= PHONE_MAX_W",
    "new": "ctx.env.viewport().w < PHONE_MAX_W",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M48",
    "file": "src/enhance/tables.ts",
    "old": "const PHONE_MAX_W = 700;",
    "new": "const PHONE_MAX_W = 699;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M49",
    "file": "src/enhance/tables.ts",
    "old": "      journal.setAttribute(t.el, 'tabindex', '0');\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M50",
    "file": "src/enhance/tables.ts",
    "old": "      journal.setAttribute(t.el, 'role', 'region');\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M51",
    "file": "src/enhance/tables.ts",
    "old": "`Table ${String(i + 1)}, scrolls sideways${heads}`",
    "new": "`Table ${String(i)}, scrolls sideways${heads}`",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M52",
    "file": "src/enhance/tables.ts",
    "old": "t.heads.slice(0, 3)",
    "new": "t.heads.slice(0, 4)",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M53",
    "file": "src/enhance/tables.ts",
    "old": "t.heads.length > 0 ? `: ${t.heads.slice(0, 3).join(', ')}` : ''",
    "new": "`: ${t.heads.slice(0, 3).join(', ')}`",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M54",
    "file": "src/enhance/tables.ts",
    "old": "    } else if (t.el.getAttribute('role') === 'region') {",
    "new": "    } else if (false) {",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M55",
    "file": "src/enhance/tables.ts",
    "old": "    } else if (t.el.getAttribute('role') === 'region') {",
    "new": "    } else {",
    "tests": "test/enhance-blocks.test.ts"
  }
]
```

## Copy and the blocks: `src/enhance/code.ts` (L2-T10-M56 to L2-T10-M71)

Copy only with the host's `copy`; the first button first in the block; a second at the foot, with `tall`, past 36 line breaks; the labels; the pre's textContent at the click; Copied or Failed by the answer, then Copy 1400 ms later, one timer per button; the label written inside an operation (RF5); a block with no pre left out, and counted in the others' numbers.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T10-M56 | copy: only when the host gave copy | `src/enhance/code.ts` | `  if (ctx.host.present.has('copy')) for` → `  for` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "no copy given, no buttons, and no tall block" |
| L2-T10-M57 | copy: the button comes first in the block | `src/enhance/code.ts` | `journal.insert(button(false), c.el, c.el.firstChild);` → `journal.insert(button(false), c.el, null);` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "with copy, one button first in each block, outside the code"; "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not" |
| L2-T10-M58 | copy: tall after more than 36 line breaks | `src/enhance/code.ts` | `.length > TALL_LINES)` → `.length >= TALL_LINES)` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not" |
| L2-T10-M59 | copy: tall's 36 is the reference's | `src/enhance/code.ts` | `const TALL_LINES = 36;` → `const TALL_LINES = 37;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not" |
| L2-T10-M60 | copy: a tall block has a second button | `src/enhance/code.ts` | `    journal.insert(button(true), c.el, null); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not"; "a code block in a figure gets no Copy, and destroy removes the buttons and the tall class" |
| L2-T10-M61 | copy: a tall block takes tall | `src/enhance/code.ts` | `    journal.toggleClass(c.el, 'tall', true); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not" |
| L2-T10-M62 | copy: the foot button's class | `src/enhance/code.ts` | `className: end ? 'code-copy end' : 'code-copy',` → `className: 'code-copy',` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not" |
| L2-T10-M63 | copy: the foot button's label | `src/enhance/code.ts` | `end ? 'Copy this code (from its foot)' : 'Copy this code'` → `'Copy this code'` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not" |
| L2-T10-M64 | copy: the pre's textContent, read at the click | `src/enhance/code.ts` | `void ctx.host.copy(pre.textContent ?? '')` → `void ctx.host.copy(pre.querySelector('code')?.textContent ?? '')` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a click hands the code's text (the pre's textContent, read then) to copy; once it returns, Copied" |
| L2-T10-M65 | copy: Copied or Failed by the answer | `src/enhance/code.ts` | `answer === undefined ? 'Copied' : 'Failed'` → `'Copied'` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a copy that rejects, or throws, shows Failed; a fulfilled one Copied" |
| L2-T10-M66 | copy: the label reads Copy again | `src/enhance/code.ts` | `            b.textContent = 'Copy'; ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the label reads Copy again 1400 ms later; a second click starts its time again" |
| L2-T10-M67 | copy: the label's 1400 ms are the reference's | `src/enhance/code.ts` | `const COPY_LABEL_MS = 1400;` → `const COPY_LABEL_MS = 1500;` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "the label reads Copy again 1400 ms later; a second click starts its time again"; "destroy clears the label timer" |
| L2-T10-M68 | copy: one label timer per button | `src/enhance/code.ts` | `          reset?.(); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the label reads Copy again 1400 ms later; a second click starts its time again" |
| L2-T10-M69 | copy: the label is written inside an operation (RF5) | `src/enhance/code.ts` | `        ctx.operate(() => {` → `        ((f: () => void) => f())(() => {` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a copy that settles after destroy writes nothing and starts no timer (RF5)" |
| L2-T10-M70 | code: a block with no pre is left out | `src/enhance/code.ts` | `    if (c.pre !== null) sized.push(` → `    if (true) sized.push(` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a code block with no pre gets no Copy and no measure, and counts in the numbers of the others" |
| L2-T10-M71 | code: the numbers count every code block | `src/enhance/code.ts` | `no: i + 1,` → `no: sized.length + 1,` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a code block with no pre gets no Copy and no measure, and counts in the numbers of the others" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T10-M56",
    "file": "src/enhance/code.ts",
    "old": "  if (ctx.host.present.has('copy')) for",
    "new": "  for",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M57",
    "file": "src/enhance/code.ts",
    "old": "journal.insert(button(false), c.el, c.el.firstChild);",
    "new": "journal.insert(button(false), c.el, null);",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M58",
    "file": "src/enhance/code.ts",
    "old": ".length > TALL_LINES)",
    "new": ".length >= TALL_LINES)",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M59",
    "file": "src/enhance/code.ts",
    "old": "const TALL_LINES = 36;",
    "new": "const TALL_LINES = 37;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M60",
    "file": "src/enhance/code.ts",
    "old": "    journal.insert(button(true), c.el, null);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M61",
    "file": "src/enhance/code.ts",
    "old": "    journal.toggleClass(c.el, 'tall', true);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M62",
    "file": "src/enhance/code.ts",
    "old": "className: end ? 'code-copy end' : 'code-copy',",
    "new": "className: 'code-copy',",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M63",
    "file": "src/enhance/code.ts",
    "old": "end ? 'Copy this code (from its foot)' : 'Copy this code'",
    "new": "'Copy this code'",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M64",
    "file": "src/enhance/code.ts",
    "old": "void ctx.host.copy(pre.textContent ?? '')",
    "new": "void ctx.host.copy(pre.querySelector('code')?.textContent ?? '')",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M65",
    "file": "src/enhance/code.ts",
    "old": "answer === undefined ? 'Copied' : 'Failed'",
    "new": "'Copied'",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M66",
    "file": "src/enhance/code.ts",
    "old": "            b.textContent = 'Copy';\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M67",
    "file": "src/enhance/code.ts",
    "old": "const COPY_LABEL_MS = 1400;",
    "new": "const COPY_LABEL_MS = 1500;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M68",
    "file": "src/enhance/code.ts",
    "old": "          reset?.();\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M69",
    "file": "src/enhance/code.ts",
    "old": "        ctx.operate(() => {",
    "new": "        ((f: () => void) => f())(() => {",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M70",
    "file": "src/enhance/code.ts",
    "old": "    if (c.pre !== null) sized.push(",
    "new": "    if (true) sized.push(",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M71",
    "file": "src/enhance/code.ts",
    "old": "no: i + 1,",
    "new": "no: sized.length + 1,",
    "tests": "test/enhance-blocks.test.ts"
  }
]
```

## Code widths: `src/enhance/code.ts` (L2-T10-M72 to L2-T10-M117)

On every relayout: `long`, the region and its removal (only of a region it made); the phone at 700 px or less; the rail from 1240 px, only with `has-toc`, never negative; the column's rem by width and face, in the root's `--rem` (16 px when that is not a length in px above 0), at most the room; the wide width at most the room; a list item's 48 px, found up to the root only; a line's 42 px; long past the column, and the region past the column on a phone and past the wide width off it; a tab's 8 characters and the longest line; the root's padding on either side; the canvas measure in the code's face and size, rounded to a thousandth, 7.5 px without one or when it measures nothing, over the sample's 40 characters. Each number of the stylesheet's (44, 52, the sans face's 2, 1120, 1200, 16, 0.78, the faces, 700) is held to `assets/reader.css` by the cases, which read it from there.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T10-M72 | widths: on every relayout | `src/enhance/code.ts` | `    size(ctx, sized); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 14 failed \| 34 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M73 | widths: long is written | `src/enhance/code.ts` | `    journal.toggleClass(b.c.el, 'long', long); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 11 failed \| 37 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "the room is the root's content box: its client width less its padding, on either side"; "a block in a list item has 48 px less room; a list item around the root is not one" |
| L2-T10-M74 | widths: the region is in the tab order | `src/enhance/code.ts` | `      journal.setAttribute(b.pre, 'tabindex', '0'); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the region is labelled with the number of the block among the code blocks, and the keyboard reaches it" |
| L2-T10-M75 | widths: the region has its role | `src/enhance/code.ts` | `      journal.setAttribute(b.pre, 'role', 'region'); ⏎ ` → (deleted) | `test/enhance-blocks.test.ts`: 7 failed \| 41 passed (48). "the room is the root's content box: its client width less its padding, on either side"; "a long block scrolls when it needs more than the stylesheet's wide width, at most the room"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below"; "the region is labelled with the number of the block among the code blocks, and the keyboard reaches it" (and 2 more printed) |
| L2-T10-M76 | widths: the region's label | `src/enhance/code.ts` | ``Code block ${String(b.no)}, scrolls sideways`` → `'Code block'` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "the region is labelled with the number of the block among the code blocks, and the keyboard reaches it"; "a code block with no pre gets no Copy and no measure, and counts in the numbers of the others" |
| L2-T10-M77 | widths: a block that fits again loses the region | `src/enhance/code.ts` | `    } else if (b.pre.getAttribute('role') === 'region') {` → `    } else if (false) {` | `test/enhance-blocks.test.ts`: 5 failed \| 43 passed (48). "the room is the root's content box: its client width less its padding, on either side"; "a long block scrolls when it needs more than the stylesheet's wide width, at most the room"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below"; "a resize measures again: the region comes and goes, and long with it" |
| L2-T10-M78 | widths: a role the host gave stays | `src/enhance/code.ts` | `    } else if (b.pre.getAttribute('role') === 'region') {` → `    } else {` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a role the host gave a pre that fits is the host's: it stays" |
| L2-T10-M79 | widths: the phone is 700 px or less | `src/enhance/code.ts` | `room.w <= PHONE_MAX_W` → `room.w < PHONE_MAX_W` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not" |
| L2-T10-M80 | widths: the phone's width is the stylesheet's | `src/enhance/code.ts` | `const PHONE_MAX_W = 700;` → `const PHONE_MAX_W = 699;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not" |
| L2-T10-M81 | widths: the rail from 1240 px | `src/enhance/code.ts` | `room.w >= RAIL_MIN_W ? room.rail : 0` → `room.w > RAIL_MIN_W ? room.rail : 0` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M82 | widths: the rail's 1240 px are LD10's | `src/enhance/code.ts` | `const RAIL_MIN_W = 1240;` → `const RAIL_MIN_W = 1241;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M83 | widths: the rail takes its width off the room | `src/enhance/code.ts` | `const avail = room.box - (room.w >= RAIL_MIN_W ? room.rail : 0);` → `const avail = room.box;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M84 | widths: the column's 44 rem against reader.css | `src/enhance/code.ts` | `{ standard: 44, wide: 52 }` → `{ standard: 45, wide: 52 }` | `test/enhance-blocks.test.ts`: 6 failed \| 42 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "a block in a list item has 48 px less room; a list item around the root is not one"; "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" (and 1 more printed) |
| L2-T10-M85 | widths: the wide column's 52 rem against reader.css | `src/enhance/code.ts` | `{ standard: 44, wide: 52 }` → `{ standard: 44, wide: 53 }` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem" |
| L2-T10-M86 | widths: the sans face's 2 rem less against reader.css | `src/enhance/code.ts` | `const SANS_REM = 2;` → `const SANS_REM = 3;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem" |
| L2-T10-M87 | widths: the sans face takes its rem off | `src/enhance/code.ts` | `(room.prefs.font === 'sans' ? SANS_REM : 0)` → `0` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem" |
| L2-T10-M88 | widths: the column is at most the room | `src/enhance/code.ts` | `const col = Math.min(measure * room.rem, avail);` → `const col = measure * room.rem;` | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "the room is the root's content box: its client width less its padding, on either side"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not"; "a resize measures again: the region comes and goes, and long with it" |
| L2-T10-M89 | widths: the column is in the root's rem | `src/enhance/code.ts` | `const col = Math.min(measure * room.rem, avail);` → `const col = Math.min(measure * REM_PX, avail);` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M90 | widths: the wide width's 1120 px against reader.css | `src/enhance/code.ts` | `{ standard: 1120, wide: 1200 }` → `{ standard: 1121, wide: 1200 }` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "a long block scrolls when it needs more than the stylesheet's wide width, at most the room"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M91 | widths: the wide width's 1200 px against reader.css | `src/enhance/code.ts` | `{ standard: 1120, wide: 1200 }` → `{ standard: 1120, wide: 1201 }` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a long block scrolls when it needs more than the stylesheet's wide width, at most the room" |
| L2-T10-M92 | widths: the wide width is at most the room | `src/enhance/code.ts` | `const wide = Math.min(WIDE_PX[room.prefs.width], avail);` → `const wide = WIDE_PX[room.prefs.width];` | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "the room is the root's content box: its client width less its padding, on either side"; "a long block scrolls when it needs more than the stylesheet's wide width, at most the room"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M93 | widths: a list item has less room | `src/enhance/code.ts` | `const fits = inList ? col - LIST_INDENT : col;` → `const fits = col;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block in a list item has 48 px less room; a list item around the root is not one" |
| L2-T10-M94 | widths: the list item's 48 px are the reference's | `src/enhance/code.ts` | `const LIST_INDENT = 48;` → `const LIST_INDENT = 47;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block in a list item has 48 px less room; a list item around the root is not one" |
| L2-T10-M95 | widths: a line's 42 px beyond its characters are the reference's | `src/enhance/code.ts` | `const CODE_PAD = 42;` → `const CODE_PAD = 43;` | `test/enhance-blocks.test.ts`: 7 failed \| 41 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "the room is the root's content box: its client width less its padding, on either side"; "a block in a list item has 48 px less room; a list item around the root is not one"; "a long block scrolls when it needs more than the stylesheet's wide width, at most the room" (and 2 more printed) |
| L2-T10-M96 | widths: long when it needs more than the column | `src/enhance/code.ts` | `long: need > fits,` → `long: need >= fits,` | `test/enhance-blocks.test.ts`: 5 failed \| 43 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "the room is the root's content box: its client width less its padding, on either side"; "a block in a list item has 48 px less room; a list item around the root is not one"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not" |
| L2-T10-M97 | widths: on a phone it scrolls past the column | `src/enhance/code.ts` | `scrolls: need > (phone ? fits : wide)` → `scrolls: need > wide` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not" |
| L2-T10-M98 | widths: off a phone it scrolls past the wide width | `src/enhance/code.ts` | `scrolls: need > (phone ? fits : wide)` → `scrolls: need > fits` | `test/enhance-blocks.test.ts`: 5 failed \| 43 passed (48). "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "a long block scrolls when it needs more than the stylesheet's wide width, at most the room"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below"; "a resize measures again: the region comes and goes, and long with it" |
| L2-T10-M99 | widths: a tab counts more than one character | `src/enhance/code.ts` | `const n = line.length + tabs * (TAB_WIDTH - 1);` → `const n = line.length;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" |
| L2-T10-M100 | widths: a tab's 8 characters are the reference's | `src/enhance/code.ts` | `const TAB_WIDTH = 8;` → `const TAB_WIDTH = 9;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" |
| L2-T10-M101 | widths: the longest line counts | `src/enhance/code.ts` | `    if (n > most) most = n;` → `    most = n;` | `test/enhance-blocks.test.ts`: 14 failed \| 34 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M102 | widths: the room less the left padding | `src/enhance/code.ts` | ` - (px(env.computed(root, 'padding-left')) ?? 0)` → (deleted) | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "the room is the root's content box: its client width less its padding, on either side"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M103 | widths: the room less the right padding | `src/enhance/code.ts` | ` - (px(env.computed(root, 'padding-right')) ?? 0)` → (deleted) | `test/enhance-blocks.test.ts`: 3 failed \| 45 passed (48). "the room is the root's content box: its client width less its padding, on either side"; "on a phone (700 px or less) a block scrolls when it needs more than the column, long or not"; "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M104 | widths: the rail only with has-toc | `src/enhance/code.ts` | `root.classList.contains('has-toc') ? ` → `true ? ` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M105 | widths: a negative rail is none | `src/enhance/code.ts` | `Math.max(0, px(env.computed(root, '--rail-w')) ?? 0)` → `(px(env.computed(root, '--rail-w')) ?? 0)` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below" |
| L2-T10-M106 | widths: the rem is the root's --rem | `src/enhance/code.ts` | `  const rem = remRead !== null && remRead > 0 ? remRead : REM_PX;` → `  const rem = REM_PX;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M107 | widths: a rem of 0 or less is the default | `src/enhance/code.ts` | `remRead !== null && remRead > 0 ? remRead : REM_PX` → `remRead !== null ? remRead : REM_PX` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M108 | widths: a length is read in px only | `src/enhance/code.ts` | `const m = /^(-?\d*\.?\d+)px$/.exec(value);` → `const m = /^(-?\d*\.?\d+)/.exec(value);` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M109 | widths: the default rem is the stylesheet's 16 px | `src/enhance/code.ts` | `const REM_PX = 16;` → `const REM_PX = 17;` | `test/enhance-blocks.test.ts`: 6 failed \| 42 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "a block in a list item has 48 px less room; a list item around the root is not one"; "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" (and 1 more printed) |
| L2-T10-M110 | widths: the code's 0.78 rem against reader.css | `src/enhance/code.ts` | `const CODE_REM = 0.78;` → `const CODE_REM = 0.8;` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" |
| L2-T10-M111 | widths: the code's faces against reader.css | `src/enhance/code.ts` | `const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monosp…` → `const MONO = 'monospace';` | `test/enhance-blocks.test.ts`: 2 failed \| 46 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" |
| L2-T10-M112 | widths: the font size is rounded to a thousandth | `src/enhance/code.ts` | `Math.round(CODE_REM * rem * 1000) / 1000` → `CODE_REM * rem` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's" |
| L2-T10-M113 | widths: a canvas that measures nothing counts as none | `src/enhance/code.ts` | `width !== null && Number.isFinite(width) && width > 0 ?` → `width !== null ?` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "without a canvas, or with one that measures nothing, a character is 7.5 px" |
| L2-T10-M114 | widths: without a canvas, the reference's 7.5 px | `src/enhance/code.ts` | `const CHAR_W_FALLBACK = 7.5;` → `const CHAR_W_FALLBACK = 8;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "without a canvas, or with one that measures nothing, a character is 7.5 px" |
| L2-T10-M115 | widths: one character is the sample over its length | `src/enhance/code.ts` | `width / SAMPLE.length` → `width / 10` | `test/enhance-blocks.test.ts`: 10 failed \| 38 passed (48). "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "the prefs move the column at once: wide makes a block of the standard column plus 1 fit"; "the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's"; "the room is the root's content box: its client width less its padding, on either side"; "a block in a list item has 48 px less room; a list item around the root is not one" |
| L2-T10-M116 | widths: a list item is looked for up to the root only | `src/enhance/code.ts` | `n !== null && n !== root; n = n.parentElement) if (n.localName === 'li')` → `n !== null; n = n.parentElement) if (n.localName === 'li')` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block in a list item has 48 px less room; a list item around the root is not one" |
| L2-T10-M117 | widths: a list item is an li | `src/enhance/code.ts` | `if (n.localName === 'li') return true;` → `if (n.localName === 'dl') return true;` | `test/enhance-blocks.test.ts`: 1 failed \| 47 passed (48). "a block in a list item has 48 px less room; a list item around the root is not one" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T10-M72",
    "file": "src/enhance/code.ts",
    "old": "    size(ctx, sized);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M73",
    "file": "src/enhance/code.ts",
    "old": "    journal.toggleClass(b.c.el, 'long', long);\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M74",
    "file": "src/enhance/code.ts",
    "old": "      journal.setAttribute(b.pre, 'tabindex', '0');\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M75",
    "file": "src/enhance/code.ts",
    "old": "      journal.setAttribute(b.pre, 'role', 'region');\n",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M76",
    "file": "src/enhance/code.ts",
    "old": "`Code block ${String(b.no)}, scrolls sideways`",
    "new": "'Code block'",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M77",
    "file": "src/enhance/code.ts",
    "old": "    } else if (b.pre.getAttribute('role') === 'region') {",
    "new": "    } else if (false) {",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M78",
    "file": "src/enhance/code.ts",
    "old": "    } else if (b.pre.getAttribute('role') === 'region') {",
    "new": "    } else {",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M79",
    "file": "src/enhance/code.ts",
    "old": "room.w <= PHONE_MAX_W",
    "new": "room.w < PHONE_MAX_W",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M80",
    "file": "src/enhance/code.ts",
    "old": "const PHONE_MAX_W = 700;",
    "new": "const PHONE_MAX_W = 699;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M81",
    "file": "src/enhance/code.ts",
    "old": "room.w >= RAIL_MIN_W ? room.rail : 0",
    "new": "room.w > RAIL_MIN_W ? room.rail : 0",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M82",
    "file": "src/enhance/code.ts",
    "old": "const RAIL_MIN_W = 1240;",
    "new": "const RAIL_MIN_W = 1241;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M83",
    "file": "src/enhance/code.ts",
    "old": "const avail = room.box - (room.w >= RAIL_MIN_W ? room.rail : 0);",
    "new": "const avail = room.box;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M84",
    "file": "src/enhance/code.ts",
    "old": "{ standard: 44, wide: 52 }",
    "new": "{ standard: 45, wide: 52 }",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M85",
    "file": "src/enhance/code.ts",
    "old": "{ standard: 44, wide: 52 }",
    "new": "{ standard: 44, wide: 53 }",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M86",
    "file": "src/enhance/code.ts",
    "old": "const SANS_REM = 2;",
    "new": "const SANS_REM = 3;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M87",
    "file": "src/enhance/code.ts",
    "old": "(room.prefs.font === 'sans' ? SANS_REM : 0)",
    "new": "0",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M88",
    "file": "src/enhance/code.ts",
    "old": "const col = Math.min(measure * room.rem, avail);",
    "new": "const col = measure * room.rem;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M89",
    "file": "src/enhance/code.ts",
    "old": "const col = Math.min(measure * room.rem, avail);",
    "new": "const col = Math.min(measure * REM_PX, avail);",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M90",
    "file": "src/enhance/code.ts",
    "old": "{ standard: 1120, wide: 1200 }",
    "new": "{ standard: 1121, wide: 1200 }",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M91",
    "file": "src/enhance/code.ts",
    "old": "{ standard: 1120, wide: 1200 }",
    "new": "{ standard: 1120, wide: 1201 }",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M92",
    "file": "src/enhance/code.ts",
    "old": "const wide = Math.min(WIDE_PX[room.prefs.width], avail);",
    "new": "const wide = WIDE_PX[room.prefs.width];",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M93",
    "file": "src/enhance/code.ts",
    "old": "const fits = inList ? col - LIST_INDENT : col;",
    "new": "const fits = col;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M94",
    "file": "src/enhance/code.ts",
    "old": "const LIST_INDENT = 48;",
    "new": "const LIST_INDENT = 47;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M95",
    "file": "src/enhance/code.ts",
    "old": "const CODE_PAD = 42;",
    "new": "const CODE_PAD = 43;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M96",
    "file": "src/enhance/code.ts",
    "old": "long: need > fits,",
    "new": "long: need >= fits,",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M97",
    "file": "src/enhance/code.ts",
    "old": "scrolls: need > (phone ? fits : wide)",
    "new": "scrolls: need > wide",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M98",
    "file": "src/enhance/code.ts",
    "old": "scrolls: need > (phone ? fits : wide)",
    "new": "scrolls: need > fits",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M99",
    "file": "src/enhance/code.ts",
    "old": "const n = line.length + tabs * (TAB_WIDTH - 1);",
    "new": "const n = line.length;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M100",
    "file": "src/enhance/code.ts",
    "old": "const TAB_WIDTH = 8;",
    "new": "const TAB_WIDTH = 9;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M101",
    "file": "src/enhance/code.ts",
    "old": "    if (n > most) most = n;",
    "new": "    most = n;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M102",
    "file": "src/enhance/code.ts",
    "old": " - (px(env.computed(root, 'padding-left')) ?? 0)",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M103",
    "file": "src/enhance/code.ts",
    "old": " - (px(env.computed(root, 'padding-right')) ?? 0)",
    "new": "",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M104",
    "file": "src/enhance/code.ts",
    "old": "root.classList.contains('has-toc') ? ",
    "new": "true ? ",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M105",
    "file": "src/enhance/code.ts",
    "old": "Math.max(0, px(env.computed(root, '--rail-w')) ?? 0)",
    "new": "(px(env.computed(root, '--rail-w')) ?? 0)",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M106",
    "file": "src/enhance/code.ts",
    "old": "  const rem = remRead !== null && remRead > 0 ? remRead : REM_PX;",
    "new": "  const rem = REM_PX;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M107",
    "file": "src/enhance/code.ts",
    "old": "remRead !== null && remRead > 0 ? remRead : REM_PX",
    "new": "remRead !== null ? remRead : REM_PX",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M108",
    "file": "src/enhance/code.ts",
    "old": "const m = /^(-?\\d*\\.?\\d+)px$/.exec(value);",
    "new": "const m = /^(-?\\d*\\.?\\d+)/.exec(value);",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M109",
    "file": "src/enhance/code.ts",
    "old": "const REM_PX = 16;",
    "new": "const REM_PX = 17;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M110",
    "file": "src/enhance/code.ts",
    "old": "const CODE_REM = 0.78;",
    "new": "const CODE_REM = 0.8;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M111",
    "file": "src/enhance/code.ts",
    "old": "const MONO = 'ui-monospace, \"SF Mono\", \"JetBrains Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", monospace';",
    "new": "const MONO = 'monospace';",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M112",
    "file": "src/enhance/code.ts",
    "old": "Math.round(CODE_REM * rem * 1000) / 1000",
    "new": "CODE_REM * rem",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M113",
    "file": "src/enhance/code.ts",
    "old": "width !== null && Number.isFinite(width) && width > 0 ?",
    "new": "width !== null ?",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M114",
    "file": "src/enhance/code.ts",
    "old": "const CHAR_W_FALLBACK = 7.5;",
    "new": "const CHAR_W_FALLBACK = 8;",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M115",
    "file": "src/enhance/code.ts",
    "old": "width / SAMPLE.length",
    "new": "width / 10",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M116",
    "file": "src/enhance/code.ts",
    "old": "n !== null && n !== root; n = n.parentElement) if (n.localName === 'li')",
    "new": "n !== null; n = n.parentElement) if (n.localName === 'li')",
    "tests": "test/enhance-blocks.test.ts"
  },
  {
    "id": "L2-T10-M117",
    "file": "src/enhance/code.ts",
    "old": "if (n.localName === 'li') return true;",
    "new": "if (n.localName === 'dl') return true;",
    "tests": "test/enhance-blocks.test.ts"
  }
]
```

## The stylesheet against the code: `assets/reader.css` (L2-T10-M118)

The other direction of the 44 rem column: the stylesheet's measure moved, the code's not.

| Row | Guard | File | Change | Red (tests in the named files) |
|---|---|---|---|---|
| L2-T10-M118 | reader.css: the column's 44 rem against the code | `assets/reader.css` | `  --measure: calc(44 * var(--rem));` → `  --measure: calc(45 * var(--rem));` | `test/enhance-blocks.test.ts`: 4 failed \| 44 passed (48). "has every number the code widths are held to"; "a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem"; "a block in a list item has 48 px less room; a list item around the root is not one"; "a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T10-M118",
    "file": "assets/reader.css",
    "old": "  --measure: calc(44 * var(--rem));",
    "new": "  --measure: calc(45 * var(--rem));",
    "tests": "test/enhance-blocks.test.ts"
  }
]
```
