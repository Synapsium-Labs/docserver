# L2 Task 14: mutation rows (navigation and the reading position)

Each guard of Task 14, deleted or inverted once, with the tests that go red: the position token and the stored
position (`src/enhance/nav.ts`'s checkAnchor and parseToken, and the feature's read of its key), the reader's place
(the lines read at startup, a hit's block, the reading column, the reading line), where a target goes (the margin of
a target with no id, and reach), restoring a place, the pin and what releases it (a wheel, a touch, a key and a
pointer press), position.keep, the flash, goTo and goToHash, the delegated click, the section link, `j` and `k`, the
landing and the position written behind (`src/enhance/position.ts`), goToHash in the lifecycle, the entry's exports,
the README's two lines and the walls' Viewport allowance. Measured 2026-10-20 on branch `l2-t14-nav`, on commit
`164e74b`, every row, L2-T14-M1 to L2-T14-M152: 151 were measured red (`rc=1`); one is reported (below),
green with its guard kept.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the changes Task 7b's rows record: a 512 MiB output
buffer, a run that ends with no exit status reported as KILLED and counted as no verdict (none here), and vitest's
`Errors` count line, `Unhandled Rejection` and `TypeError` lines kept in what it prints. Each row is applied to its own
throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the
checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once
in its file. The rows ran one at a time, in eight batches of at most 20, with `DOCREADER_BROWSERS=chromium`: the
six rows whose tests are in a real browser (`test/browser/nav.test.ts`, and the layout corpus for the section
link's heading levels) ran in Chromium. No row is WebKit-only; the browser cases are green in both browsers (WebKit in
the Playwright image, C51). The checkout was never edited: `git status --porcelain` read the same (empty) before and
after, and so did `HEAD` and the hash of `git diff`. The Red column gives the count line and at most three of the
failing tests the run printed. Every count line adds up to its total.

Notes on the measurement.
- Before measuring, every check that no case could redden was removed rather than left unmeasured (the commits
  `17e3b8b` and `e218533` say which): an array test and an own-property test that the fields' type checks already
  cover, a second bound on an anchor's id, a live() check that the caller or env.scrollTo already makes, the data-line
  grammar that the id alphabet includes, a pagehide's cancel of a wait that then finds the same place, a walk bound at
  the root that both maps already imply, and `k`'s index test that `?? null` already covers.
- A first pass over the rows, on the commits before `164e74b`, left five green. L2-T14-M54 and M55 (a touch and a key
  release the pin) were green because the case read the four events from the list it tests: it now names them itself.
  L2-T14-M69 (no place is read while a pin holds) was green because the case kept at the top of the page, where no
  place is read anyway: it now keeps off the top. L2-T14-M98 (goToHash stops when a revealer destroys the instance)
  was green because nothing after the check wrote anything: the case now waits out the bar's hold first and checks it
  stays off. All four are red here. L2-T14-M130 is the reported row.
- The reported row, L2-T14-M130, is the landing's `live()` check right after it reveals initialHash's target. reveal()
  can reach the host (a fold's state is written behind, and set() may destroy the instance), so the check stays, as C52
  keeps a `live()` check after a call-out; what follows it, the pin and the save's listeners, already does nothing once
  the instance is not live, so no case can tell the check from its absence. It is not in its section's JSON fence, so a
  run of the fences reports no green row.
- L2-T14-M38 (a browser without scrollIntoView skips it) is measured through Task 7b's cases, whose headings have no
  scrollIntoView in jsdom; its run also counts two errors, the `TypeError`s thrown inside click handlers.
- Eleven rows of Task 7b, and one of Task 7a, named code this task rewrote; their guards are rows here, on the new code
  (the last section maps them).

## The position token and the stored position: `src/enhance/nav.ts`, `src/enhance/position.ts` (L2-T14-M1 to L2-T14-M15)

checkAnchor, which a stored position and a `from` token both pass (RF4): an object; `line` null, or a string within its bound in the id alphabet; `offset` and `y` numbers within theirs, `y` not negative; parseToken's bound and parse; tokenOf for no place; and the feature reading its key only with a position key.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M1 | a value that is not an object is no anchor | `src/enhance/nav.ts` | `  if (v === null \|\| typeof v !== 'object') return null; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 6 failed \| 42 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left"; "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash"; "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored"; and 3 more |
| L2-T14-M2 | a line is null or a string | `src/enhance/nav.ts` | `line !== null && !(typeof line === 'string' && line.length` → `line !== null && !(line.length` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M3 | a line is at most TOKEN.line code units | `src/enhance/nav.ts` | `line.length <= TOKEN.line && LINE_OR_ID` → `LINE_OR_ID` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M4 | a line holds no selector character | `src/enhance/nav.ts` | ` && LINE_OR_ID.test(line))) return null;` → `)) return null;` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored"; "an id: revealed, brought up at once and flashed, not focused; null or empty: the top; a bad from is no token" |
| L2-T14-M5 | an offset is a number | `src/enhance/nav.ts` | `  if (typeof offset !== 'number' \|\| !(Math.abs(offset) <= TOKEN.coord)) return null;` → `  if (!(Math.abs(offset as number) <= TOKEN.coord)) return null;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M6 | an offset is finite and within TOKEN.coord | `src/enhance/nav.ts` | `  if (typeof offset !== 'number' \|\| !(Math.abs(offset) <= TOKEN.coord)) return null;` → `  if (typeof offset !== 'number') return null;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M7 | a scroll position is a number | `src/enhance/nav.ts` | `  if (typeof y !== 'number' \|\| !(y >= 0 && y <= TOKEN.coord)) return null;` → `  if (!((y as number) >= 0 && (y as number) <= TOKEN.coord)) return null;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M8 | a scroll position is not negative | `src/enhance/nav.ts` | `!(y >= 0 && y <= TOKEN.coord)` → `!(y <= TOKEN.coord)` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M9 | a scroll position is within TOKEN.coord | `src/enhance/nav.ts` | `!(y >= 0 && y <= TOKEN.coord)` → `!(y >= 0)` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M10 | no token is no anchor | `src/enhance/nav.ts` | `  if (text === null \|\| text.length > TOKEN.from) return null;` → `  if ((text as string).length > TOKEN.from) return null;` | `test/enhance-nav.test.ts`: 9 failed \| 39 passed (48). "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window"; "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room"; "with no heading to read the bar from, a margin is --bar-h in px, else no bar"; and 3 more |
| L2-T14-M11 | a token is at most TOKEN.from code units | `src/enhance/nav.ts` | `  if (text === null \|\| text.length > TOKEN.from) return null;` → `  if (text === null) return null;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M12 | a token that is not JSON is no anchor | `src/enhance/nav.ts` | `  try { ⏎     return checkAnchor(JSON.parse(text)); ⏎   } catch { ⏎     return null; ⏎   }` → `  return checkAnchor(JSON.parse(text));` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored" |
| L2-T14-M13 | no place is no token | `src/enhance/nav.ts` | `  return a === null ? null : JSON.stringify(` → `  return JSON.stringify((a as Anchor) && ` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a heading whose id another heading holds first gets none; a click on the link goes to its heading with push" |
| L2-T14-M14 | the stored position is checked before use | `src/enhance/position.ts` | `checkAnchor(state.readPos(posKey))` → `(state.readPos(posKey) as ReturnType<typeof checkAnchor>)` | `test/enhance-nav.test.ts`: 6 failed \| 42 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left"; "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash"; "RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored"; and 3 more |
| L2-T14-M15 | with no position key, no key is read | `src/enhance/position.ts` | `const stored = posKey === null ? null : checkAnchor(state.readPos(posKey));` → `const stored = checkAnchor(state.readPos(posKey as string));` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a stored place the reader is still at is not written again; with no position key nothing is read or written" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M1",
    "guard": "a value that is not an object is no anchor",
    "file": "src/enhance/nav.ts",
    "old": "  if (v === null || typeof v !== 'object') return null;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M2",
    "guard": "a line is null or a string",
    "file": "src/enhance/nav.ts",
    "old": "line !== null && !(typeof line === 'string' && line.length",
    "new": "line !== null && !(line.length",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M3",
    "guard": "a line is at most TOKEN.line code units",
    "file": "src/enhance/nav.ts",
    "old": "line.length <= TOKEN.line && LINE_OR_ID",
    "new": "LINE_OR_ID",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M4",
    "guard": "a line holds no selector character",
    "file": "src/enhance/nav.ts",
    "old": " && LINE_OR_ID.test(line))) return null;",
    "new": ")) return null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M5",
    "guard": "an offset is a number",
    "file": "src/enhance/nav.ts",
    "old": "  if (typeof offset !== 'number' || !(Math.abs(offset) <= TOKEN.coord)) return null;",
    "new": "  if (!(Math.abs(offset as number) <= TOKEN.coord)) return null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M6",
    "guard": "an offset is finite and within TOKEN.coord",
    "file": "src/enhance/nav.ts",
    "old": "  if (typeof offset !== 'number' || !(Math.abs(offset) <= TOKEN.coord)) return null;",
    "new": "  if (typeof offset !== 'number') return null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M7",
    "guard": "a scroll position is a number",
    "file": "src/enhance/nav.ts",
    "old": "  if (typeof y !== 'number' || !(y >= 0 && y <= TOKEN.coord)) return null;",
    "new": "  if (!((y as number) >= 0 && (y as number) <= TOKEN.coord)) return null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M8",
    "guard": "a scroll position is not negative",
    "file": "src/enhance/nav.ts",
    "old": "!(y >= 0 && y <= TOKEN.coord)",
    "new": "!(y <= TOKEN.coord)",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M9",
    "guard": "a scroll position is within TOKEN.coord",
    "file": "src/enhance/nav.ts",
    "old": "!(y >= 0 && y <= TOKEN.coord)",
    "new": "!(y >= 0)",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M10",
    "guard": "no token is no anchor",
    "file": "src/enhance/nav.ts",
    "old": "  if (text === null || text.length > TOKEN.from) return null;",
    "new": "  if ((text as string).length > TOKEN.from) return null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M11",
    "guard": "a token is at most TOKEN.from code units",
    "file": "src/enhance/nav.ts",
    "old": "  if (text === null || text.length > TOKEN.from) return null;",
    "new": "  if (text === null) return null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M12",
    "guard": "a token that is not JSON is no anchor",
    "file": "src/enhance/nav.ts",
    "old": "  try {\n    return checkAnchor(JSON.parse(text));\n  } catch {\n    return null;\n  }",
    "new": "  return checkAnchor(JSON.parse(text));",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M13",
    "guard": "no place is no token",
    "file": "src/enhance/nav.ts",
    "old": "  return a === null ? null : JSON.stringify(",
    "new": "  return JSON.stringify((a as Anchor) && ",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M14",
    "guard": "the stored position is checked before use",
    "file": "src/enhance/position.ts",
    "old": "checkAnchor(state.readPos(posKey))",
    "new": "(state.readPos(posKey) as ReturnType<typeof checkAnchor>)",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M15",
    "guard": "with no position key, no key is read",
    "file": "src/enhance/position.ts",
    "old": "const stored = posKey === null ? null : checkAnchor(state.readPos(posKey));",
    "new": "const stored = checkAnchor(state.readPos(posKey as string));",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## The document's blocks and the reader's place: `src/enhance/nav.ts` (L2-T14-M16 to L2-T14-M28)

The lines read at startup; a hit's block (the document's own element of that line, or an id in the token alphabet); the column the reading line is read across, its bound, its fallback and its clamps; the reading line below the bar; and no place at the top.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M16 | the document's lines are read at startup | `src/enhance/nav.ts` | `    if (line !== null) lines.set(line, el); // a block inside one of the same lines (a quote's paragraph) wins ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 11 failed \| 37 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left"; "initialHash wins over a stored position; without it the stored position is restored and pinned"; "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again"; and 2 more |
| L2-T14-M17 | a hit's block is the document's own element of that line | `src/enhance/nav.ts` | `if (line !== null && lines.get(line) === n) return { el: n, line };` → `if (line !== null) return { el: n, line };` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a chrome element and an element the document did not have are no anchors; the block holding them is" |
| L2-T14-M18 | an id with a character outside the token alphabet is no anchor | `src/enhance/nav.ts` | `if (id !== null && LINE_OR_ID.test(id)) return { el: n, line: id };` → `if (id !== null) return { el: n, line: id };` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a footnote reference's id holds a colon: the paragraph around it is the anchor" |
| L2-T14-M19 | a block with no box is not the column | `src/enhance/nav.ts` | `      if (box.width > 0) {` → `      if (box.width >= 0) {` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "the reading line is read a third into the reading column: the first of the document's blocks with a box, at most 240 px in"; "the column is looked for in the document's first 16 blocks only; past them the root stands for it" |
| L2-T14-M20 | the column is looked for in the first COLUMN_SCAN blocks only | `src/enhance/nav.ts` | `      if (seen >= COLUMN_SCAN) break; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the column is looked for in the document's first 16 blocks only; past them the root stands for it" |
| L2-T14-M21 | with no column found, the root stands for it | `src/enhance/nav.ts` | `    r ??= root.getBoundingClientRect();` → `    r ??= { left: 0, width: 0 } as DOMRect;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the column is looked for in the document's first 16 blocks only; past them the root stands for it" |
| L2-T14-M22 | the reading line is read inside the viewport | `src/enhance/nav.ts` | `    return Math.min(w - 4, Math.max(4, r.left + Math.min(240, r.width / 3)));` → `    return r.left + Math.min(240, r.width / 3);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the reading line is read a third into the reading column: the first of the document's blocks with a box, at most 240 px in" |
| L2-T14-M23 | at most 240 px into the column | `src/enhance/nav.ts` | `r.left + Math.min(240, r.width / 3)));` → `r.left + r.width / 3));` | `test/enhance-nav.test.ts`: 3 failed \| 45 passed (48). "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs"; "the reading line is below the bar: a hit is looked for from its bottom"; "the reading line is read a third into the reading column: the first of the document's blocks with a box, at most 240 px in" |
| L2-T14-M24 | ten points, every 24 px down to 240 px | `src/enhance/nav.ts` | `    for (let dy = 0; dy < 240; dy += 24) {` → `    for (let dy = 0; dy < 24; dy += 24) {` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "nothing hit: back to the scroll position; a throwing fn still restores, then throws" |
| L2-T14-M25 | the reading line is 12 px below the bar | `src/enhance/nav.ts` | `    const top = barBottom() + 12;` → `    const top = 12;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the reading line is below the bar: a hit is looked for from its bottom" |
| L2-T14-M26 | a hidden bar is no bar | `src/enhance/nav.ts` | `    if (bar === null \|\| root.classList.contains('bar-hidden')) return 0;` → `    if (bar === null) return 0;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the reading line is below the bar: a hit is looked for from its bottom" |
| L2-T14-M27 | a bar scrolled away is no bar | `src/enhance/nav.ts` | `    return Math.max(0, bar.getBoundingClientRect().bottom);` → `    return bar.getBoundingClientRect().bottom;` | `test/enhance-nav.test.ts`: 4 failed \| 44 passed (48). "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs"; "the reading line is read a third into the reading column: the first of the document's blocks with a box, at most 240 px in"; "the column is looked for in the document's first 16 blocks only; past them the root stands for it"; and 1 more |
| L2-T14-M28 | nothing hit at the top is no place | `src/enhance/nav.ts` | `    return scrollY > 0 ? Object.freeze({ line: null, offset: 0, y: scrollY }) : null;` → `    return Object.freeze({ line: null, offset: 0, y: scrollY });` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again"; "a heading whose id another heading holds first gets none; a click on the link goes to its heading with push" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M16",
    "guard": "the document's lines are read at startup",
    "file": "src/enhance/nav.ts",
    "old": "    if (line !== null) lines.set(line, el); // a block inside one of the same lines (a quote's paragraph) wins\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M17",
    "guard": "a hit's block is the document's own element of that line",
    "file": "src/enhance/nav.ts",
    "old": "if (line !== null && lines.get(line) === n) return { el: n, line };",
    "new": "if (line !== null) return { el: n, line };",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M18",
    "guard": "an id with a character outside the token alphabet is no anchor",
    "file": "src/enhance/nav.ts",
    "old": "if (id !== null && LINE_OR_ID.test(id)) return { el: n, line: id };",
    "new": "if (id !== null) return { el: n, line: id };",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M19",
    "guard": "a block with no box is not the column",
    "file": "src/enhance/nav.ts",
    "old": "      if (box.width > 0) {",
    "new": "      if (box.width >= 0) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M20",
    "guard": "the column is looked for in the first COLUMN_SCAN blocks only",
    "file": "src/enhance/nav.ts",
    "old": "      if (seen >= COLUMN_SCAN) break;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M21",
    "guard": "with no column found, the root stands for it",
    "file": "src/enhance/nav.ts",
    "old": "    r ??= root.getBoundingClientRect();",
    "new": "    r ??= { left: 0, width: 0 } as DOMRect;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M22",
    "guard": "the reading line is read inside the viewport",
    "file": "src/enhance/nav.ts",
    "old": "    return Math.min(w - 4, Math.max(4, r.left + Math.min(240, r.width / 3)));",
    "new": "    return r.left + Math.min(240, r.width / 3);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M23",
    "guard": "at most 240 px into the column",
    "file": "src/enhance/nav.ts",
    "old": "r.left + Math.min(240, r.width / 3)));",
    "new": "r.left + r.width / 3));",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M24",
    "guard": "ten points, every 24 px down to 240 px",
    "file": "src/enhance/nav.ts",
    "old": "    for (let dy = 0; dy < 240; dy += 24) {",
    "new": "    for (let dy = 0; dy < 24; dy += 24) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M25",
    "guard": "the reading line is 12 px below the bar",
    "file": "src/enhance/nav.ts",
    "old": "    const top = barBottom() + 12;",
    "new": "    const top = 12;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M26",
    "guard": "a hidden bar is no bar",
    "file": "src/enhance/nav.ts",
    "old": "    if (bar === null || root.classList.contains('bar-hidden')) return 0;",
    "new": "    if (bar === null) return 0;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M27",
    "guard": "a bar scrolled away is no bar",
    "file": "src/enhance/nav.ts",
    "old": "    return Math.max(0, bar.getBoundingClientRect().bottom);",
    "new": "    return bar.getBoundingClientRect().bottom;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M28",
    "guard": "nothing hit at the top is no place",
    "file": "src/enhance/nav.ts",
    "old": "    return scrollY > 0 ? Object.freeze({ line: null, offset: 0, y: scrollY }) : null;",
    "new": "    return Object.freeze({ line: null, offset: 0, y: scrollY });",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## Where a target goes: `src/enhance/nav.ts` (L2-T14-M29 to L2-T14-M40)

The margin of a target with no id (the first heading's `[id]` margin, the bar it implies, `--bar-h` without a heading, a row's head room), the px reading, and reach (a target that left the root, the browser's own scroll for an id, its behaviour, the window's for the rest).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M29 | the [id] margin is read off a heading | `src/enhance/nav.ts` | `      if (!/^h[1-6]$/.test(h.localName)) continue; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the [id] margin is read off the first heading, past an anchor that comes before it" |
| L2-T14-M30 | the bar a heading's margin implies is never below 0 | `src/enhance/nav.ts` | `Math.max(0, idMargin - ID_GAP)` → `idMargin - ID_GAP` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room" |
| L2-T14-M31 | with no heading, --bar-h in px is the bar | `src/enhance/nav.ts` | `(px(env.computed(root, '--bar-h')) ?? 0)` → `0` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "with no heading to read the bar from, a margin is --bar-h in px, else no bar" |
| L2-T14-M32 | a row has a margin of its own | `src/enhance/nav.ts` | `    if (el.localName === 'tr') return` → `    if (el.localName === 'never') return` | `test/enhance-nav.test.ts`: 5 failed \| 43 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left"; "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window"; "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room"; and 2 more |
| L2-T14-M33 | a row clears the table head's height | `src/enhance/nav.ts` | `(px(env.computed(el, '--thead-h')) ?? HEAD_GAP)` → `HEAD_GAP` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window" |
| L2-T14-M34 | a target that is not a row takes the [id] margin itself | `src/enhance/nav.ts` | `    return idMargin ?? barH + ID_GAP;` → `    return barH + ID_GAP;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room" |
| L2-T14-M35 | a length is read in px | `src/enhance/nav.ts` | `  return m === null ? null : Number(m[1]);` → `  return m === null ? null : null;` | `test/enhance-nav.test.ts`: 4 failed \| 44 passed (48). "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window"; "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room"; "the [id] margin is read off the first heading, past an anchor that comes before it"; and 1 more |
| L2-T14-M36 | a target that left the root is not scrolled to | `src/enhance/nav.ts` | `    if (!root.contains(el)) return; // it left the root since (a pin held on it) ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a pinned target that left the root is not scrolled to; a pin after destroy listens for nothing" |
| L2-T14-M37 | an element with an id is scrolled by the browser, with the stylesheet's margin | `src/enhance/nav.ts` | `    if (el.hasAttribute('id')) {` → `    if (el.hasAttribute('data-none')) {` | `test/enhance-nav.test.ts`: 18 failed \| 30 passed (48). "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash" |
| L2-T14-M38 | a browser without scrollIntoView skips it | `src/enhance/nav.ts` | `      if (typeof target.scrollIntoView === 'function') target.scrollIntoView(` → `      target.scrollIntoView(` | `test/enhance-services.test.ts`: 3 failed \| 91 passed (94). Errors 2 errors. "a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone"; "goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root"; "a click under a link around the root is not the root's; an encoded id is decoded; a malformed one is no error" |
| L2-T14-M39 | a jump at once is not smooth | `src/enhance/nav.ts` | `behavior: smooth ? 'smooth' : 'auto' });` → `behavior: 'smooth' });` | `test/enhance-nav.test.ts`: 4 failed \| 44 passed (48). "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash"; "initialHash wins over a stored position; without it the stored position is restored and pinned"; "a smooth goTo releases a pin; one made at once (reduced motion, or more than two screens away) pins"; and 1 more |
| L2-T14-M40 | the window scrolls smoothly when asked | `src/enhance/nav.ts` | `- marginOf(el), smooth);` → `- marginOf(el));` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M29",
    "guard": "the [id] margin is read off a heading",
    "file": "src/enhance/nav.ts",
    "old": "      if (!/^h[1-6]$/.test(h.localName)) continue;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M30",
    "guard": "the bar a heading's margin implies is never below 0",
    "file": "src/enhance/nav.ts",
    "old": "Math.max(0, idMargin - ID_GAP)",
    "new": "idMargin - ID_GAP",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M31",
    "guard": "with no heading, --bar-h in px is the bar",
    "file": "src/enhance/nav.ts",
    "old": "(px(env.computed(root, '--bar-h')) ?? 0)",
    "new": "0",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M32",
    "guard": "a row has a margin of its own",
    "file": "src/enhance/nav.ts",
    "old": "    if (el.localName === 'tr') return",
    "new": "    if (el.localName === 'never') return",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M33",
    "guard": "a row clears the table head's height",
    "file": "src/enhance/nav.ts",
    "old": "(px(env.computed(el, '--thead-h')) ?? HEAD_GAP)",
    "new": "HEAD_GAP",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M34",
    "guard": "a target that is not a row takes the [id] margin itself",
    "file": "src/enhance/nav.ts",
    "old": "    return idMargin ?? barH + ID_GAP;",
    "new": "    return barH + ID_GAP;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M35",
    "guard": "a length is read in px",
    "file": "src/enhance/nav.ts",
    "old": "  return m === null ? null : Number(m[1]);",
    "new": "  return m === null ? null : null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M36",
    "guard": "a target that left the root is not scrolled to",
    "file": "src/enhance/nav.ts",
    "old": "    if (!root.contains(el)) return; // it left the root since (a pin held on it)\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M37",
    "guard": "an element with an id is scrolled by the browser, with the stylesheet's margin",
    "file": "src/enhance/nav.ts",
    "old": "    if (el.hasAttribute('id')) {",
    "new": "    if (el.hasAttribute('data-none')) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M38",
    "guard": "a browser without scrollIntoView skips it",
    "file": "src/enhance/nav.ts",
    "old": "      if (typeof target.scrollIntoView === 'function') target.scrollIntoView(",
    "new": "      target.scrollIntoView(",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T14-M39",
    "guard": "a jump at once is not smooth",
    "file": "src/enhance/nav.ts",
    "old": "behavior: smooth ? 'smooth' : 'auto' });",
    "new": "behavior: 'smooth' });",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M40",
    "guard": "the window scrolls smoothly when asked",
    "file": "src/enhance/nav.ts",
    "old": "- marginOf(el), smooth);",
    "new": "- marginOf(el));",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## Restoring a place: `src/enhance/nav.ts` (L2-T14-M41 to L2-T14-M47)

A block hidden by an attribute, or with no box in a laid-out page, is not restored to; in a page with no layout a block counts as shown; the block named by its line, while it is in the root, else by an id; its offset; and the scroll position when there is no block.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M41 | a block a hidden attribute hides is not restored to | `src/enhance/nav.ts` | `    for (let n: Element \| null = el; n !== null && n !== root; n = n.parentElement) if (n.hasAttribute('hidden')) return false; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id" |
| L2-T14-M42 | a block with no box in a laid-out page is not restored to | `src/enhance/nav.ts` | `    return el.getClientRects().length > 0 \|\| root.getClientRects().length === 0;` → `    return true;` | `test/browser/nav.test.ts`: 1 failed \| 5 passed \| 6 skipped (12). "goToHash with the from token onHash gave restores the block's offset within 2 px, after a block above it grew" |
| L2-T14-M43 | in a page with no layout a block counts as shown | `src/enhance/nav.ts` | `    return el.getClientRects().length > 0 \|\| root.getClientRects().length === 0;` → `    return el.getClientRects().length > 0;` | `test/enhance-nav.test.ts`: 5 failed \| 43 passed (48). "initialHash wins over a stored position; without it the stored position is restored and pinned"; "a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id"; "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs"; and 2 more |
| L2-T14-M44 | a block that left the root is not restored to | `src/enhance/nav.ts` | `    const el = lines.get(line); ⏎     if (el !== undefined && root.contains(el)) return el;` → `    const el = lines.get(line); ⏎     if (el !== undefined) return el;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a block that left the root since is no place to restore: back to the scroll position" |
| L2-T14-M45 | a place named by an id is found by it | `src/enhance/nav.ts` | `    return byId(line); ⏎   }; ⏎  ⏎   const restore` → `    return null; ⏎   }; ⏎  ⏎   const restore` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id" |
| L2-T14-M46 | the block comes back to its offset | `src/enhance/nav.ts` | `env.viewport().scrollY - a.offset);` → `env.viewport().scrollY);` | `test/enhance-nav.test.ts`: 6 failed \| 42 passed (48). "initialHash wins over a stored position; without it the stored position is restored and pinned"; "a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id"; "a stored place the reader is still at is not written again; with no position key nothing is read or written"; and 3 more |
| L2-T14-M47 | no block: back to the scroll position | `src/enhance/nav.ts` | `    else env.scrollTo(a.y); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 3 failed \| 45 passed (48). "a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id"; "nothing hit: back to the scroll position; a throwing fn still restores, then throws"; "a block that left the root since is no place to restore: back to the scroll position" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M41",
    "guard": "a block a hidden attribute hides is not restored to",
    "file": "src/enhance/nav.ts",
    "old": "    for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) if (n.hasAttribute('hidden')) return false;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M42",
    "guard": "a block with no box in a laid-out page is not restored to",
    "file": "src/enhance/nav.ts",
    "old": "    return el.getClientRects().length > 0 || root.getClientRects().length === 0;",
    "new": "    return true;",
    "tests": "test/browser/nav.test.ts"
  },
  {
    "id": "L2-T14-M43",
    "guard": "in a page with no layout a block counts as shown",
    "file": "src/enhance/nav.ts",
    "old": "    return el.getClientRects().length > 0 || root.getClientRects().length === 0;",
    "new": "    return el.getClientRects().length > 0;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M44",
    "guard": "a block that left the root is not restored to",
    "file": "src/enhance/nav.ts",
    "old": "    const el = lines.get(line);\n    if (el !== undefined && root.contains(el)) return el;",
    "new": "    const el = lines.get(line);\n    if (el !== undefined) return el;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M45",
    "guard": "a place named by an id is found by it",
    "file": "src/enhance/nav.ts",
    "old": "    return byId(line);\n  };\n\n  const restore",
    "new": "    return null;\n  };\n\n  const restore",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M46",
    "guard": "the block comes back to its offset",
    "file": "src/enhance/nav.ts",
    "old": "env.viewport().scrollY - a.offset);",
    "new": "env.viewport().scrollY);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M47",
    "guard": "no block: back to the scroll position",
    "file": "src/enhance/nav.ts",
    "old": "    else env.scrollTo(a.y);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## The pin: `src/enhance/nav.ts` (L2-T14-M48 to L2-T14-M67)

Its release (the pin, its listeners, timer and observer; at destroy; the reader acting on wheel, touch, key and pointer, in the capture phase), a scroll that throws, one pin at a time, none after destroy, the end of the smooth wait, PIN_MS, the root's size, and its first application.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M48 | a release ends the pin | `src/enhance/nav.ts` | `    pinned = null; ⏎     for (const end` → `    for (const end` | `test/enhance-nav.test.ts`: 6 failed \| 42 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait"; "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press"; "a reader act inside another root ends it too; another pin replaces it; it ends after PIN_MS"; and 3 more |
| L2-T14-M49 | a release ends its listeners, timer and observer | `src/enhance/nav.ts` | `    for (const end of ends.splice(0)) end(); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 3 failed \| 45 passed (48). "destroy cancels the pending write and the pin"; "a new pin cancels the old one's timer: it holds its own PIN_MS"; "the root changing size holds it, where the window can observe sizes" |
| L2-T14-M50 | destroy releases the pin | `src/enhance/nav.ts` | `  journal.defer(release); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "destroy cancels the pending write and the pin" |
| L2-T14-M51 | a pin whose scroll throws ends there | `src/enhance/nav.ts` | `    try { ⏎       pinned?.(); ⏎     } catch { ⏎       release(); ⏎     }` → `    pinned?.();` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a pin whose scroll throws ends there, and the throw goes no further" |
| L2-T14-M52 | the reader acting releases the pin | `src/enhance/nav.ts` | `    operate(release);` → `    void operate;` | `test/enhance-nav.test.ts`: 4 failed \| 44 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait"; "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press"; "a reader act inside another root ends it too; another pin replaces it; it ends after PIN_MS"; and 1 more |
| L2-T14-M53 | a wheel releases the pin | `src/enhance/nav.ts` | `export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;` → `export const PIN_RELEASE = ['touchstart', 'keydown', 'pointerdown'] as const;` | `test/enhance-nav.test.ts`: 3 failed \| 45 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait"; "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press"; "the root changing size holds it, where the window can observe sizes" |
| L2-T14-M54 | a touch releases the pin | `src/enhance/nav.ts` | `export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;` → `export const PIN_RELEASE = ['wheel', 'keydown', 'pointerdown'] as const;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press" |
| L2-T14-M55 | a key releases the pin | `src/enhance/nav.ts` | `export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;` → `export const PIN_RELEASE = ['wheel', 'touchstart', 'pointerdown'] as const;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press" |
| L2-T14-M56 | a pointer press releases the pin | `src/enhance/nav.ts` | `export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;` → `export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown'] as const;` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press"; "a reader act inside another root ends it too; another pin replaces it; it ends after PIN_MS" |
| L2-T14-M57 | a key releases the pin, in a real browser | `src/enhance/nav.ts` | `export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;` → `export const PIN_RELEASE = ['wheel', 'touchstart', 'pointerdown'] as const;` | `test/browser/nav.test.ts`: 1 failed \| 5 passed \| 6 skipped (12). "the pin holds the target while a block above it grows; once the reader presses a key it no longer does" |
| L2-T14-M58 | the pin listens for the reader acting | `src/enhance/nav.ts` | `    for (const type of PIN_RELEASE) doc.addEventListener(type, onAct, { capture: true, passive: true }); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 5 failed \| 43 passed (48). "destroy cancels the pending write and the pin"; "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait"; "holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press"; and 2 more |
| L2-T14-M59 | it listens in the capture phase | `src/enhance/nav.ts` | `doc.addEventListener(type, onAct, { capture: true, passive: true });` → `doc.addEventListener(type, onAct, { passive: true });` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "destroy cancels the pending write and the pin" |
| L2-T14-M60 | a new pin ends the one before | `src/enhance/nav.ts` | `    release(); ⏎     if (!live()) return; ⏎     smoothUntil = 0;` → `    if (!live()) return; ⏎     smoothUntil = 0;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a new pin cancels the old one's timer: it holds its own PIN_MS" |
| L2-T14-M61 | no pin once the instance is not live | `src/enhance/nav.ts` | `    if (!live()) return; ⏎     smoothUntil = 0;` → `    smoothUntil = 0;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a pinned target that left the root is not scrolled to; a pin after destroy listens for nothing" |
| L2-T14-M62 | a pin ends the smooth wait | `src/enhance/nav.ts` | `    smoothUntil = 0; ⏎     pinned = apply;` → `    pinned = apply;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait" |
| L2-T14-M63 | a pin ends after PIN_MS | `src/enhance/nav.ts` | `    ends.push(env.timeout(release, PIN_MS)); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "a reader act inside another root ends it too; another pin replaces it; it ends after PIN_MS"; "a new pin cancels the old one's timer: it holds its own PIN_MS" |
| L2-T14-M64 | the root's size is watched | `src/enhance/nav.ts` | `      watch.observe(root); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the root changing size holds it, where the window can observe sizes" |
| L2-T14-M65 | a window with no size observer holds no observer | `src/enhance/nav.ts` | `    if (watch !== null) {` → `    if (watch !== undefined) {` | `test/enhance-nav.test.ts`: 22 failed \| 26 passed (48). (red through a type or load error of the run; no case listed) |
| L2-T14-M66 | the observer ends with the pin | `src/enhance/nav.ts` | `      ends.push(watch.cancel); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the root changing size holds it, where the window can observe sizes" |
| L2-T14-M67 | a pin is applied at once | `src/enhance/nav.ts` | `    hold(); ⏎   }; ⏎  ⏎   // ── keep` → `  }; ⏎  ⏎   // ── keep` | `test/enhance-nav.test.ts`: 19 failed \| 29 passed (48). "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M48",
    "guard": "a release ends the pin",
    "file": "src/enhance/nav.ts",
    "old": "    pinned = null;\n    for (const end",
    "new": "    for (const end",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M49",
    "guard": "a release ends its listeners, timer and observer",
    "file": "src/enhance/nav.ts",
    "old": "    for (const end of ends.splice(0)) end();\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M50",
    "guard": "destroy releases the pin",
    "file": "src/enhance/nav.ts",
    "old": "  journal.defer(release);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M51",
    "guard": "a pin whose scroll throws ends there",
    "file": "src/enhance/nav.ts",
    "old": "    try {\n      pinned?.();\n    } catch {\n      release();\n    }",
    "new": "    pinned?.();",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M52",
    "guard": "the reader acting releases the pin",
    "file": "src/enhance/nav.ts",
    "old": "    operate(release);",
    "new": "    void operate;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M53",
    "guard": "a wheel releases the pin",
    "file": "src/enhance/nav.ts",
    "old": "export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;",
    "new": "export const PIN_RELEASE = ['touchstart', 'keydown', 'pointerdown'] as const;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M54",
    "guard": "a touch releases the pin",
    "file": "src/enhance/nav.ts",
    "old": "export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;",
    "new": "export const PIN_RELEASE = ['wheel', 'keydown', 'pointerdown'] as const;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M55",
    "guard": "a key releases the pin",
    "file": "src/enhance/nav.ts",
    "old": "export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;",
    "new": "export const PIN_RELEASE = ['wheel', 'touchstart', 'pointerdown'] as const;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M56",
    "guard": "a pointer press releases the pin",
    "file": "src/enhance/nav.ts",
    "old": "export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;",
    "new": "export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown'] as const;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M57",
    "guard": "a key releases the pin, in a real browser",
    "file": "src/enhance/nav.ts",
    "old": "export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;",
    "new": "export const PIN_RELEASE = ['wheel', 'touchstart', 'pointerdown'] as const;",
    "tests": "test/browser/nav.test.ts"
  },
  {
    "id": "L2-T14-M58",
    "guard": "the pin listens for the reader acting",
    "file": "src/enhance/nav.ts",
    "old": "    for (const type of PIN_RELEASE) doc.addEventListener(type, onAct, { capture: true, passive: true });\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M59",
    "guard": "it listens in the capture phase",
    "file": "src/enhance/nav.ts",
    "old": "doc.addEventListener(type, onAct, { capture: true, passive: true });",
    "new": "doc.addEventListener(type, onAct, { passive: true });",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M60",
    "guard": "a new pin ends the one before",
    "file": "src/enhance/nav.ts",
    "old": "    release();\n    if (!live()) return;\n    smoothUntil = 0;",
    "new": "    if (!live()) return;\n    smoothUntil = 0;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M61",
    "guard": "no pin once the instance is not live",
    "file": "src/enhance/nav.ts",
    "old": "    if (!live()) return;\n    smoothUntil = 0;",
    "new": "    smoothUntil = 0;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M62",
    "guard": "a pin ends the smooth wait",
    "file": "src/enhance/nav.ts",
    "old": "    smoothUntil = 0;\n    pinned = apply;",
    "new": "    pinned = apply;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M63",
    "guard": "a pin ends after PIN_MS",
    "file": "src/enhance/nav.ts",
    "old": "    ends.push(env.timeout(release, PIN_MS));\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M64",
    "guard": "the root's size is watched",
    "file": "src/enhance/nav.ts",
    "old": "      watch.observe(root);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M65",
    "guard": "a window with no size observer holds no observer",
    "file": "src/enhance/nav.ts",
    "old": "    if (watch !== null) {",
    "new": "    if (watch !== undefined) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M66",
    "guard": "the observer ends with the pin",
    "file": "src/enhance/nav.ts",
    "old": "      ends.push(watch.cancel);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M67",
    "guard": "a pin is applied at once",
    "file": "src/enhance/nav.ts",
    "old": "    hold();\n  };\n\n  // ── keep",
    "new": "  };\n\n  // ── keep",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## position.keep: `src/enhance/nav.ts` (L2-T14-M68 to L2-T14-M75)

Anchor now, restore after: a keep inside a keep only runs; no place read while a pin holds, while a smooth jump runs, or at the top; the pin held after; the place restored after; the answer of `fn`; and the smooth wait a smooth jump starts.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M68 | a keep inside a keep only runs | `src/enhance/nav.ts` | `    if (keeping > 0) return fn(); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs" |
| L2-T14-M69 | no place is read while a pin holds | `src/enhance/nav.ts` | `const at = pinned !== null \|\| env.now()` → `const at = env.now()` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a new pin cancels the old one's timer: it holds its own PIN_MS" |
| L2-T14-M70 | no place is read while a smooth jump runs | `src/enhance/nav.ts` | ` \|\| env.now() < smoothUntil \|\| ` → ` \|\| ` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait" |
| L2-T14-M71 | no place is read at the top | `src/enhance/nav.ts` | ` \|\| env.viewport().scrollY < 1 ? null : anchor();` → ` ? null : anchor();` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs" |
| L2-T14-M72 | the pin is held after | `src/enhance/nav.ts` | `      if (pinned !== null) hold(); ⏎       else if` → `      if (pinned === undefined) hold(); ⏎       else if` | `test/enhance-nav.test.ts`: 8 failed \| 40 passed (48). "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash"; "initialHash wins over a stored position; without it the stored position is restored and pinned"; "destroy cancels the pending write and the pin"; and 3 more |
| L2-T14-M73 | the place is restored after | `src/enhance/nav.ts` | `      else if (at !== null) restore(at); // env.scrollTo does nothing once not live` → `      else if (at !== null) void at;` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs"; "nothing hit: back to the scroll position; a throwing fn still restores, then throws" |
| L2-T14-M74 | keep answers what fn answers | `src/enhance/nav.ts` | `      return fn(); ⏎     } finally {` → `      fn(); ⏎       return undefined as T; ⏎     } finally {` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs" |
| L2-T14-M75 | a smooth jump starts the smooth wait | `src/enhance/nav.ts` | `      smoothUntil = env.now() + SMOOTH_MS; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M68",
    "guard": "a keep inside a keep only runs",
    "file": "src/enhance/nav.ts",
    "old": "    if (keeping > 0) return fn();\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M69",
    "guard": "no place is read while a pin holds",
    "file": "src/enhance/nav.ts",
    "old": "const at = pinned !== null || env.now()",
    "new": "const at = env.now()",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M70",
    "guard": "no place is read while a smooth jump runs",
    "file": "src/enhance/nav.ts",
    "old": " || env.now() < smoothUntil || ",
    "new": " || ",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M71",
    "guard": "no place is read at the top",
    "file": "src/enhance/nav.ts",
    "old": " || env.viewport().scrollY < 1 ? null : anchor();",
    "new": " ? null : anchor();",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M72",
    "guard": "the pin is held after",
    "file": "src/enhance/nav.ts",
    "old": "      if (pinned !== null) hold();\n      else if",
    "new": "      if (pinned === undefined) hold();\n      else if",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M73",
    "guard": "the place is restored after",
    "file": "src/enhance/nav.ts",
    "old": "      else if (at !== null) restore(at); // env.scrollTo does nothing once not live",
    "new": "      else if (at !== null) void at;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M74",
    "guard": "keep answers what fn answers",
    "file": "src/enhance/nav.ts",
    "old": "      return fn();\n    } finally {",
    "new": "      fn();\n      return undefined as T;\n    } finally {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M75",
    "guard": "a smooth jump starts the smooth wait",
    "file": "src/enhance/nav.ts",
    "old": "      smoothUntil = env.now() + SMOOTH_MS;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## The flash: `src/enhance/nav.ts` (L2-T14-M76 to L2-T14-M82)

One timer per target, the animation started again (in a real browser), its end after FLASH_MS, goTo's flash option and its default, and goToHash's flash.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M76 | a second flash cancels the first one's timer | `src/enhance/nav.ts` | `    flashes.get(el)?.(); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goTo flashes its target for FLASH_MS; a second flash starts it again; flash: false does not; destroy removes it" |
| L2-T14-M77 | a second flash starts the animation again | `src/enhance/nav.ts` | `    journal.toggleClass(el, 'flash', false); ⏎     void (el as HTMLElement).offsetWidth;` → `    void (el as HTMLElement).offsetWidth;` | `test/browser/nav.test.ts`: 1 failed \| 5 passed \| 6 skipped (12). "a second jump to a target still flashing starts its flash again" |
| L2-T14-M78 | a style recalc between the two starts it again | `src/enhance/nav.ts` | `    void (el as HTMLElement).offsetWidth; // a style recalc between the two, so the animation starts again ⏎ ` → (deleted) | `test/browser/nav.test.ts`: 1 failed \| 5 passed \| 6 skipped (12). "a second jump to a target still flashing starts its flash again" |
| L2-T14-M79 | the flash ends after FLASH_MS | `src/enhance/nav.ts` | `      env.timeout(() => { ⏎         journal.toggleClass(el, 'flash', false); ⏎       }, FLASH_MS),` → `      env.timeout(() => undefined, FLASH_MS),` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goTo flashes its target for FLASH_MS; a second flash starts it again; flash: false does not; destroy removes it" |
| L2-T14-M80 | flash: false does not flash | `src/enhance/nav.ts` | `    if (how.flash ?? true) flash(el);` → `    flash(el);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goTo flashes its target for FLASH_MS; a second flash starts it again; flash: false does not; destroy removes it" |
| L2-T14-M81 | goTo flashes by default | `src/enhance/nav.ts` | `    if (how.flash ?? true) flash(el);` → `    if (how.flash ?? false) flash(el);` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left"; "goTo flashes its target for FLASH_MS; a second flash starts it again; flash: false does not; destroy removes it" |
| L2-T14-M82 | goToHash flashes its target | `src/enhance/nav.ts` | `    jump(target, false); ⏎     flash(target);` → `    jump(target, false);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "an id: revealed, brought up at once and flashed, not focused; null or empty: the top; a bad from is no token" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M76",
    "guard": "a second flash cancels the first one's timer",
    "file": "src/enhance/nav.ts",
    "old": "    flashes.get(el)?.();\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M77",
    "guard": "a second flash starts the animation again",
    "file": "src/enhance/nav.ts",
    "old": "    journal.toggleClass(el, 'flash', false);\n    void (el as HTMLElement).offsetWidth;",
    "new": "    void (el as HTMLElement).offsetWidth;",
    "tests": "test/browser/nav.test.ts"
  },
  {
    "id": "L2-T14-M78",
    "guard": "a style recalc between the two starts it again",
    "file": "src/enhance/nav.ts",
    "old": "    void (el as HTMLElement).offsetWidth; // a style recalc between the two, so the animation starts again\n",
    "new": "",
    "tests": "test/browser/nav.test.ts"
  },
  {
    "id": "L2-T14-M79",
    "guard": "the flash ends after FLASH_MS",
    "file": "src/enhance/nav.ts",
    "old": "      env.timeout(() => {\n        journal.toggleClass(el, 'flash', false);\n      }, FLASH_MS),",
    "new": "      env.timeout(() => undefined, FLASH_MS),",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M80",
    "guard": "flash: false does not flash",
    "file": "src/enhance/nav.ts",
    "old": "    if (how.flash ?? true) flash(el);",
    "new": "    flash(el);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M81",
    "guard": "goTo flashes by default",
    "file": "src/enhance/nav.ts",
    "old": "    if (how.flash ?? true) flash(el);",
    "new": "    if (how.flash ?? false) flash(el);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M82",
    "guard": "goToHash flashes its target",
    "file": "src/enhance/nav.ts",
    "old": "    jump(target, false);\n    flash(target);",
    "new": "    jump(target, false);",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## goTo and goToHash: `src/enhance/nav.ts` (L2-T14-M83 to L2-T14-M100)

The `from` token (measured only for a host that hears it, and handed over), the smooth jump's two exceptions, the bar's hold, onHash only with an id; goToHash's token path (the bar, the pin), its top (an empty id, the pin and the smooth wait ended, the scroll), its stop by a revealer, and its id path (the bar, at once, nothing for an id that names nothing).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M83 | the place left is measured only for a host that hears it | `src/enhance/nav.ts` | `const from = id !== null && host.present.has('onHash') ? tokenOf(anchor()) : null;` → `const from = tokenOf(anchor());` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "without onHash no place is measured; a target with no id makes no onHash" |
| L2-T14-M84 | onHash gets the place left | `src/enhance/nav.ts` | `    if (id !== null) host.onHash(id, { push, from });` → `    if (id !== null) host.onHash(id, { push, from: null });` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left"; "a from token: back to its place, pinned; it calls no onHash" |
| L2-T14-M85 | reduced motion jumps at once | `src/enhance/nav.ts` | `    jump(el, !(env.reducedMotion() \|\| far));` → `    jump(el, !far);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a smooth goTo releases a pin; one made at once (reduced motion, or more than two screens away) pins" |
| L2-T14-M86 | a target two screens away is jumped to at once | `src/enhance/nav.ts` | `    jump(el, !(env.reducedMotion() \|\| far));` → `    jump(el, !env.reducedMotion());` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a smooth goTo releases a pin; one made at once (reduced motion, or more than two screens away) pins" |
| L2-T14-M87 | reduced motion jumps at once, in a real browser | `src/enhance/nav.ts` | `    jump(el, !(env.reducedMotion() \|\| far));` → `    jump(el, !far);` | `test/browser/nav.test.ts`: 1 failed \| 5 passed \| 6 skipped (12). "with reduced motion a jump is made at once" |
| L2-T14-M88 | goTo holds the bar | `src/enhance/nav.ts` | `    holdBar(); ⏎     const far` → `    const far` | `test/enhance-services.test.ts`: 1 failed \| 93 passed (94). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |
| L2-T14-M89 | a target with no id makes no onHash | `src/enhance/nav.ts` | `    if (id !== null) host.onHash(id, { push, from });` → `    host.onHash(id, { push, from });` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "without onHash no place is measured; a target with no id makes no onHash" |
| L2-T14-M90 | a token goes back to its place | `src/enhance/nav.ts` | `    if (back !== null) {` → `    if (back === undefined) {` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "a from token: back to its place, pinned; it calls no onHash"; "it holds the bar; null ends a pin; a revealer that destroys the instance stops it" |
| L2-T14-M91 | a token holds the bar | `src/enhance/nav.ts` | `      holdBar(); ⏎       pin(() => { ⏎         restore(back);` → `      pin(() => { ⏎         restore(back);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "it holds the bar; null ends a pin; a revealer that destroys the instance stops it" |
| L2-T14-M92 | a token's place is pinned | `src/enhance/nav.ts` | `      pin(() => { ⏎         restore(back); ⏎       });` → `      restore(back);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a from token: back to its place, pinned; it calls no onHash" |
| L2-T14-M93 | an empty id goes to the top | `src/enhance/nav.ts` | `    if (id === null \|\| id === '') {` → `    if (id === null) {` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "an id: revealed, brought up at once and flashed, not focused; null or empty: the top; a bad from is no token" |
| L2-T14-M94 | the top ends a pin | `src/enhance/nav.ts` | `      release(); ⏎       smoothUntil = 0; ⏎       env.scrollTo(0);` → `      smoothUntil = 0; ⏎       env.scrollTo(0);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "it holds the bar; null ends a pin; a revealer that destroys the instance stops it" |
| L2-T14-M95 | the top ends the smooth wait | `src/enhance/nav.ts` | `      smoothUntil = 0; ⏎       env.scrollTo(0);` → `      env.scrollTo(0);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait" |
| L2-T14-M96 | null goes to the top | `src/enhance/nav.ts` | `      env.scrollTo(0); ⏎       return;` → `      return;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "an id: revealed, brought up at once and flashed, not focused; null or empty: the top; a bad from is no token" |
| L2-T14-M97 | an id that names nothing goes nowhere | `src/enhance/nav.ts` | `    if (target === null) return; ⏎     reveal(target);` → `    reveal(target as Element);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "an id: revealed, brought up at once and flashed, not focused; null or empty: the top; a bad from is no token" |
| L2-T14-M98 | goToHash stops when a revealer destroys the instance | `src/enhance/nav.ts` | `    reveal(target); ⏎     if (!live()) return; ⏎     holdBar();` → `    reveal(target); ⏎     holdBar();` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "it holds the bar; null ends a pin; a revealer that destroys the instance stops it" |
| L2-T14-M99 | goToHash holds the bar for an id | `src/enhance/nav.ts` | `    holdBar(); ⏎     jump(target, false);` → `    jump(target, false);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "it holds the bar; null ends a pin; a revealer that destroys the instance stops it" |
| L2-T14-M100 | goToHash jumps at once | `src/enhance/nav.ts` | `    jump(target, false); ⏎     flash(target);` → `    jump(target, true); ⏎     flash(target);` | `test/enhance-nav.test.ts`: 7 failed \| 41 passed (48). "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window"; "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room"; "with no heading to read the bar from, a margin is --bar-h in px, else no bar"; and 4 more |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M83",
    "guard": "the place left is measured only for a host that hears it",
    "file": "src/enhance/nav.ts",
    "old": "const from = id !== null && host.present.has('onHash') ? tokenOf(anchor()) : null;",
    "new": "const from = tokenOf(anchor());",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M84",
    "guard": "onHash gets the place left",
    "file": "src/enhance/nav.ts",
    "old": "    if (id !== null) host.onHash(id, { push, from });",
    "new": "    if (id !== null) host.onHash(id, { push, from: null });",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M85",
    "guard": "reduced motion jumps at once",
    "file": "src/enhance/nav.ts",
    "old": "    jump(el, !(env.reducedMotion() || far));",
    "new": "    jump(el, !far);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M86",
    "guard": "a target two screens away is jumped to at once",
    "file": "src/enhance/nav.ts",
    "old": "    jump(el, !(env.reducedMotion() || far));",
    "new": "    jump(el, !env.reducedMotion());",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M87",
    "guard": "reduced motion jumps at once, in a real browser",
    "file": "src/enhance/nav.ts",
    "old": "    jump(el, !(env.reducedMotion() || far));",
    "new": "    jump(el, !far);",
    "tests": "test/browser/nav.test.ts"
  },
  {
    "id": "L2-T14-M88",
    "guard": "goTo holds the bar",
    "file": "src/enhance/nav.ts",
    "old": "    holdBar();\n    const far",
    "new": "    const far",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T14-M89",
    "guard": "a target with no id makes no onHash",
    "file": "src/enhance/nav.ts",
    "old": "    if (id !== null) host.onHash(id, { push, from });",
    "new": "    host.onHash(id, { push, from });",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M90",
    "guard": "a token goes back to its place",
    "file": "src/enhance/nav.ts",
    "old": "    if (back !== null) {",
    "new": "    if (back === undefined) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M91",
    "guard": "a token holds the bar",
    "file": "src/enhance/nav.ts",
    "old": "      holdBar();\n      pin(() => {\n        restore(back);",
    "new": "      pin(() => {\n        restore(back);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M92",
    "guard": "a token's place is pinned",
    "file": "src/enhance/nav.ts",
    "old": "      pin(() => {\n        restore(back);\n      });",
    "new": "      restore(back);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M93",
    "guard": "an empty id goes to the top",
    "file": "src/enhance/nav.ts",
    "old": "    if (id === null || id === '') {",
    "new": "    if (id === null) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M94",
    "guard": "the top ends a pin",
    "file": "src/enhance/nav.ts",
    "old": "      release();\n      smoothUntil = 0;\n      env.scrollTo(0);",
    "new": "      smoothUntil = 0;\n      env.scrollTo(0);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M95",
    "guard": "the top ends the smooth wait",
    "file": "src/enhance/nav.ts",
    "old": "      smoothUntil = 0;\n      env.scrollTo(0);",
    "new": "      env.scrollTo(0);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M96",
    "guard": "null goes to the top",
    "file": "src/enhance/nav.ts",
    "old": "      env.scrollTo(0);\n      return;",
    "new": "      return;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M97",
    "guard": "an id that names nothing goes nowhere",
    "file": "src/enhance/nav.ts",
    "old": "    if (target === null) return;\n    reveal(target);",
    "new": "    reveal(target as Element);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M98",
    "guard": "goToHash stops when a revealer destroys the instance",
    "file": "src/enhance/nav.ts",
    "old": "    reveal(target);\n    if (!live()) return;\n    holdBar();",
    "new": "    reveal(target);\n    holdBar();",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M99",
    "guard": "goToHash holds the bar for an id",
    "file": "src/enhance/nav.ts",
    "old": "    holdBar();\n    jump(target, false);",
    "new": "    jump(target, false);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M100",
    "guard": "goToHash jumps at once",
    "file": "src/enhance/nav.ts",
    "old": "    jump(target, false);\n    flash(target);",
    "new": "    jump(target, true);\n    flash(target);",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## The delegated click, byId and idOf, and the bar's hold: `src/enhance/nav.ts` (L2-T14-M101 to L2-T14-M106)

The two click rules this task changed (a modified hash click and a hash link this root cannot resolve both go on to onLink), and the rows of Task 7b whose code this task rewrote (see the last section).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M101 | a modified click on a hash link goes on to onLink | `src/enhance/nav.ts` | ` && !(e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey)) {` → `) {` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a modified click on a hash link, and a sibling document's link, go to onLink with newTab; without onLink the browser follows" |
| L2-T14-M102 | a hash link this root cannot resolve goes on to onLink | `src/enhance/nav.ts` | `      if (target !== null) { ⏎         e.preventDefault(); ⏎         goTo(target, { push: true });` → `      { ⏎         e.preventDefault(); ⏎         goTo(target as Element, { push: true });` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a hash link this root cannot resolve goes to onLink when the host gave it; otherwise the browser follows it" |
| L2-T14-M103 | byId: an element that left the root is no answer | `src/enhance/nav.ts` | `    const el = ids.get(id); ⏎     if (el !== undefined && root.contains(el)) return el;` → `    const el = ids.get(id); ⏎     if (el !== undefined) return el;` | `test/enhance-services.test.ts`: 1 failed \| 93 passed (94). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T14-M104 | idOf: an id the instance did not read is no answer | `src/enhance/nav.ts` | `(el.id !== '' && ids.get(el.id) === el ? el.id : null)` → `(el.id !== '' ? el.id : null)` | `test/enhance-services.test.ts`: 1 failed \| 93 passed (94). "byId: the first element of a repeated id; never an empty id; an element, or a defined ID's target, that left the root is no answer" |
| L2-T14-M105 | holdBar holds the bar for BAR_HOLD_MS | `src/enhance/nav.ts` | `    heldUntil = env.now() + BAR_HOLD_MS;` → `    heldUntil = env.now() + BAR_HOLD_MS / 2;` | `test/enhance-services.test.ts`: 1 failed \| 93 passed (94). "goTo holds the bar, focuses only when asked, and scrolls the target into view where it can" |
| L2-T14-M106 | placeOf takes only an instance's position | `src/enhance/nav.ts` | `  if (place === undefined) throw new Error('docreader: placeOf takes the position of an instance'); ⏎   return place;` → `  return place as Place;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "placeOf takes only the position of an instance" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M101",
    "guard": "a modified click on a hash link goes on to onLink",
    "file": "src/enhance/nav.ts",
    "old": " && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {",
    "new": ") {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M102",
    "guard": "a hash link this root cannot resolve goes on to onLink",
    "file": "src/enhance/nav.ts",
    "old": "      if (target !== null) {\n        e.preventDefault();\n        goTo(target, { push: true });",
    "new": "      {\n        e.preventDefault();\n        goTo(target as Element, { push: true });",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M103",
    "guard": "byId: an element that left the root is no answer",
    "file": "src/enhance/nav.ts",
    "old": "    const el = ids.get(id);\n    if (el !== undefined && root.contains(el)) return el;",
    "new": "    const el = ids.get(id);\n    if (el !== undefined) return el;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T14-M104",
    "guard": "idOf: an id the instance did not read is no answer",
    "file": "src/enhance/nav.ts",
    "old": "(el.id !== '' && ids.get(el.id) === el ? el.id : null)",
    "new": "(el.id !== '' ? el.id : null)",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T14-M105",
    "guard": "holdBar holds the bar for BAR_HOLD_MS",
    "file": "src/enhance/nav.ts",
    "old": "    heldUntil = env.now() + BAR_HOLD_MS;",
    "new": "    heldUntil = env.now() + BAR_HOLD_MS / 2;",
    "tests": "test/enhance-services.test.ts"
  },
  {
    "id": "L2-T14-M106",
    "guard": "placeOf takes only an instance's position",
    "file": "src/enhance/nav.ts",
    "old": "  if (place === undefined) throw new Error('docreader: placeOf takes the position of an instance');\n  return place;",
    "new": "  return place as Place;",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## The section link: `src/enhance/position.ts` (L2-T14-M107 to L2-T14-M114)

One link per level-2 and level-3 heading that holds its own id, none in the "In short" box; its name from the heading's own label, without a chrome control, less the section number; its href; its slot.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M107 | a heading whose id another element holds first takes no link | `src/enhance/position.ts` | `    if (nav.byId(h.id) !== h \|\| inShort(root, h)) continue;` → `    if (inShort(root, h)) continue;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a heading whose id another heading holds first gets none; a click on the link goes to its heading with push" |
| L2-T14-M108 | the "In short" heading takes no link | `src/enhance/position.ts` | `    if (nav.byId(h.id) !== h \|\| inShort(root, h)) continue;` → `    if (nav.byId(h.id) !== h) continue;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "each level-2 and level-3 heading with its own id gets a # link in the anchor slot; In short and a repeated id get none" |
| L2-T14-M109 | the name is the heading's own label | `src/enhance/position.ts` | `(h.getAttribute('aria-label') ?? headingText(h, isControl))` → `headingText(h, isControl)` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "each level-2 and level-3 heading with its own id gets a # link in the anchor slot; In short and a repeated id get none" |
| L2-T14-M110 | a chrome control is no part of the name | `src/enhance/position.ts` | `(h.getAttribute('aria-label') ?? headingText(h, isControl))` → `(h.getAttribute('aria-label') ?? headingText(h, () => false))` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a control a feature put in a heading before it (a chrome button) is no part of the link's name" |
| L2-T14-M111 | the name leaves out the section number | `src/enhance/position.ts` | `.replace(NUMBER, '');` → `;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "each level-2 and level-3 heading with its own id gets a # link in the anchor slot; In short and a repeated id get none" |
| L2-T14-M112 | level-2 and level-3 headings only | `src/enhance/position.ts` | `root.querySelectorAll('h2[id], h3[id]')` → `root.querySelectorAll('h2[id], h3[id], h4[id]')` | `test/browser/layout-corpus.test.ts`: 1 failed \| 14 passed \| 10 skipped (25). "nav/links" |
| L2-T14-M113 | the link goes to the heading | `src/enhance/position.ts` | `href: `#${h.id}`` → `href: '#'` | `test/enhance-nav.test.ts`: 3 failed \| 45 passed (48). "RF1: __proto__, constructor and an id named like chrome are document ids; an id the document lacks lands nowhere"; "each level-2 and level-3 heading with its own id gets a # link in the anchor slot; In short and a repeated id get none"; "a heading whose id another heading holds first gets none; a click on the link goes to its heading with push" |
| L2-T14-M114 | the link is the heading's anchor control | `src/enhance/position.ts` | `    ctx.headCtl(h, 'anchor', link); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 4 failed \| 44 passed (48). "RF1: __proto__, constructor and an id named like chrome are document ids; an id the document lacks lands nowhere"; "each level-2 and level-3 heading with its own id gets a # link in the anchor slot; In short and a repeated id get none"; "a control a feature put in a heading before it (a chrome button) is no part of the link's name"; and 1 more |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M107",
    "guard": "a heading whose id another element holds first takes no link",
    "file": "src/enhance/position.ts",
    "old": "    if (nav.byId(h.id) !== h || inShort(root, h)) continue;",
    "new": "    if (inShort(root, h)) continue;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M108",
    "guard": "the \"In short\" heading takes no link",
    "file": "src/enhance/position.ts",
    "old": "    if (nav.byId(h.id) !== h || inShort(root, h)) continue;",
    "new": "    if (nav.byId(h.id) !== h) continue;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M109",
    "guard": "the name is the heading's own label",
    "file": "src/enhance/position.ts",
    "old": "(h.getAttribute('aria-label') ?? headingText(h, isControl))",
    "new": "headingText(h, isControl)",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M110",
    "guard": "a chrome control is no part of the name",
    "file": "src/enhance/position.ts",
    "old": "(h.getAttribute('aria-label') ?? headingText(h, isControl))",
    "new": "(h.getAttribute('aria-label') ?? headingText(h, () => false))",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M111",
    "guard": "the name leaves out the section number",
    "file": "src/enhance/position.ts",
    "old": ".replace(NUMBER, '');",
    "new": ";",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M112",
    "guard": "level-2 and level-3 headings only",
    "file": "src/enhance/position.ts",
    "old": "root.querySelectorAll('h2[id], h3[id]')",
    "new": "root.querySelectorAll('h2[id], h3[id], h4[id]')",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T14-M113",
    "guard": "the link goes to the heading",
    "file": "src/enhance/position.ts",
    "old": "href: `#${h.id}`",
    "new": "href: '#'",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M114",
    "guard": "the link is the heading's anchor control",
    "file": "src/enhance/position.ts",
    "old": "    ctx.headCtl(h, 'anchor', link);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## `j` and `k`: `src/enhance/position.ts` (L2-T14-M115 to L2-T14-M127)

The current section (the last spy event's once one has come; else at the reading line, 30% of the viewport, at least 150 px), `j` (the next, nothing past the end, no push), `k` (this start beyond 40 px below the bar's bottom, else the previous, nothing before the first, no push), and the keys only with sections.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M115 | the current section is the last spy event's | `src/enhance/position.ts` | `    if (heard) return spied; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the current section is the last spy event's once one has come; before the first section, j goes to it" |
| L2-T14-M116 | a spy event is heard | `src/enhance/position.ts` | `    heard = true; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the current section is the last spy event's once one has come; before the first section, j goes to it" |
| L2-T14-M117 | the reading line is at least 150 px down | `src/enhance/position.ts` | `Math.max(150, env.viewport().h * 0.3)` → `env.viewport().h * 0.3` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the reading line is 30% down the viewport, but never above 150 px" |
| L2-T14-M118 | the reading line is 30% down the viewport | `src/enhance/position.ts` | `Math.max(150, env.viewport().h * 0.3)` → `Math.max(150, env.viewport().h * 0.1)` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the reading line is 30% down the viewport, but never above 150 px" |
| L2-T14-M119 | j: nothing past the last section | `src/enhance/position.ts` | `      if (next === undefined) return false; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "j: the next section; k: this section's start, or the previous one within 40 px; nothing past either end; no push" |
| L2-T14-M120 | j: before the first section, the first | `src/enhance/position.ts` | `heads[(sec === null ? -1 : heads.indexOf(sec)) + 1]` → `heads[(sec === null ? 0 : heads.indexOf(sec)) + 1]` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "the current section is the last spy event's once one has come; before the first section, j goes to it" |
| L2-T14-M121 | j makes no history entry | `src/enhance/position.ts` | `      nav.goTo(next, { push: false });` → `      nav.goTo(next);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "j: the next section; k: this section's start, or the previous one within 40 px; nothing past either end; no push" |
| L2-T14-M122 | k: this section's start when 40 px past it | `src/enhance/position.ts` | `place.barBottom() - BACK_PX` → `place.barBottom()` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "j: the next section; k: this section's start, or the previous one within 40 px; nothing past either end; no push" |
| L2-T14-M123 | k measures from the bar's bottom | `src/enhance/position.ts` | `place.barBottom() - BACK_PX` → `0 - BACK_PX` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "k measures from the bar's bottom: within 40 px below it is still a section's start" |
| L2-T14-M124 | k: else the previous section | `src/enhance/position.ts` | `      else back = heads[si - 1] ?? null; // none before the first section` → `      else back = heads[si] ?? null;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "j: the next section; k: this section's start, or the previous one within 40 px; nothing past either end; no push" |
| L2-T14-M125 | k: nothing before the first section | `src/enhance/position.ts` | `      if (back === null) return false; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "j: the next section; k: this section's start, or the previous one within 40 px; nothing past either end; no push"; "the current section is the last spy event's once one has come; before the first section, j goes to it" |
| L2-T14-M126 | k makes no history entry | `src/enhance/position.ts` | `      nav.goTo(back, { push: false });` → `      nav.goTo(back);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "j: the next section; k: this section's start, or the previous one within 40 px; nothing past either end; no push" |
| L2-T14-M127 | j and k only with sections | `src/enhance/position.ts` | `    label: 'Next section', ⏎     when: some,` → `    label: 'Next section',` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a document with no sections lists neither key" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M115",
    "guard": "the current section is the last spy event's",
    "file": "src/enhance/position.ts",
    "old": "    if (heard) return spied;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M116",
    "guard": "a spy event is heard",
    "file": "src/enhance/position.ts",
    "old": "    heard = true;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M117",
    "guard": "the reading line is at least 150 px down",
    "file": "src/enhance/position.ts",
    "old": "Math.max(150, env.viewport().h * 0.3)",
    "new": "env.viewport().h * 0.3",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M118",
    "guard": "the reading line is 30% down the viewport",
    "file": "src/enhance/position.ts",
    "old": "Math.max(150, env.viewport().h * 0.3)",
    "new": "Math.max(150, env.viewport().h * 0.1)",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M119",
    "guard": "j: nothing past the last section",
    "file": "src/enhance/position.ts",
    "old": "      if (next === undefined) return false;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M120",
    "guard": "j: before the first section, the first",
    "file": "src/enhance/position.ts",
    "old": "heads[(sec === null ? -1 : heads.indexOf(sec)) + 1]",
    "new": "heads[(sec === null ? 0 : heads.indexOf(sec)) + 1]",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M121",
    "guard": "j makes no history entry",
    "file": "src/enhance/position.ts",
    "old": "      nav.goTo(next, { push: false });",
    "new": "      nav.goTo(next);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M122",
    "guard": "k: this section's start when 40 px past it",
    "file": "src/enhance/position.ts",
    "old": "place.barBottom() - BACK_PX",
    "new": "place.barBottom()",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M123",
    "guard": "k measures from the bar's bottom",
    "file": "src/enhance/position.ts",
    "old": "place.barBottom() - BACK_PX",
    "new": "0 - BACK_PX",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M124",
    "guard": "k: else the previous section",
    "file": "src/enhance/position.ts",
    "old": "      else back = heads[si - 1] ?? null; // none before the first section",
    "new": "      else back = heads[si] ?? null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M125",
    "guard": "k: nothing before the first section",
    "file": "src/enhance/position.ts",
    "old": "      if (back === null) return false;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M126",
    "guard": "k makes no history entry",
    "file": "src/enhance/position.ts",
    "old": "      nav.goTo(back, { push: false });",
    "new": "      nav.goTo(back);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M127",
    "guard": "j and k only with sections",
    "file": "src/enhance/position.ts",
    "old": "    label: 'Next section',\n    when: some,",
    "new": "    label: 'Next section',",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## Landing and the position written behind: `src/enhance/position.ts` (L2-T14-M128 to L2-T14-M141)

initialHash wins over the stored position; its target revealed and pinned at once; the stored position pinned; and the write: only with a position key, not the stored place again, not the same place twice, one wait for a burst, SAVE_MS, at pagehide.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M128 | initialHash wins over a stored position | `src/enhance/position.ts` | `  } else if (stored !== null) {` → `  } ⏎   if (stored !== null) {` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "initialHash wins over a stored position; without it the stored position is restored and pinned" |
| L2-T14-M129 | initialHash's target is revealed | `src/enhance/position.ts` | `      ctx.reveal(target); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash"; "a revealer that destroys the instance while it lands stops it: no pin, and enhance() rejects" |
| L2-T14-M130 | the landing stops when a revealer destroys the instance | `src/enhance/position.ts` | `      if (!ctx.live()) return; ⏎       place.pin(` → `      place.pin(` | Reported (green, guard kept): reveal() can reach the host (a fold's state is written behind), so the check after it stays (C52); what follows it does nothing once the instance is not live (pin() and env's listeners check), so no case can tell it from its absence. Not in its section's JSON fence. |
| L2-T14-M131 | the landing is made at once | `src/enhance/position.ts` | `        place.reach(target, false);` → `        place.reach(target, true);` | `test/enhance-nav.test.ts`: 6 failed \| 42 passed (48). "initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash"; "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window"; "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room"; and 3 more |
| L2-T14-M132 | the stored position is restored | `src/enhance/position.ts` | `      place.restore(stored);` → `      void stored;` | `test/enhance-nav.test.ts`: 3 failed \| 45 passed (48). "initialHash wins over a stored position; without it the stored position is restored and pinned"; "a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id"; "a stored place the reader is still at is not written again; with no position key nothing is read or written" |
| L2-T14-M133 | with no position key nothing is written | `src/enhance/position.ts` | `  if (posKey === null) return; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a stored place the reader is still at is not written again; with no position key nothing is read or written" |
| L2-T14-M134 | the stored place is not written again | `src/enhance/position.ts` | `  let last = tokenOf(stored);` → `  let last: string \| null = null;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a stored place the reader is still at is not written again; with no position key nothing is read or written" |
| L2-T14-M135 | the same place is not written twice | `src/enhance/position.ts` | `    if (text === last) return; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again"; "a stored place the reader is still at is not written again; with no position key nothing is read or written" |
| L2-T14-M136 | the place written is remembered | `src/enhance/position.ts` | `    last = text; ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again" |
| L2-T14-M137 | the place is written behind | `src/enhance/position.ts` | `    state.writePos(posKey, now); ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again" |
| L2-T14-M138 | a burst of scrolling is one wait | `src/enhance/position.ts` | `    waiting?.(); // a burst of scrolling is one wait ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again" |
| L2-T14-M139 | the write waits for scrolling to stop | `src/enhance/position.ts` | `    waiting = env.timeout(save, SAVE_MS);` → `    save();` | `test/enhance-nav.test.ts`: 2 failed \| 46 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again"; "destroy cancels the pending write and the pin" |
| L2-T14-M140 | it waits SAVE_MS | `src/enhance/position.ts` | `const SAVE_MS = 250;` → `const SAVE_MS = 500;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again" |
| L2-T14-M141 | the place is written when the page is hidden | `src/enhance/position.ts` | `  env.onPageHide(save); // a wait still pending then finds the same place, and writes nothing ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M128",
    "guard": "initialHash wins over a stored position",
    "file": "src/enhance/position.ts",
    "old": "  } else if (stored !== null) {",
    "new": "  }\n  if (stored !== null) {",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M129",
    "guard": "initialHash's target is revealed",
    "file": "src/enhance/position.ts",
    "old": "      ctx.reveal(target);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M131",
    "guard": "the landing is made at once",
    "file": "src/enhance/position.ts",
    "old": "        place.reach(target, false);",
    "new": "        place.reach(target, true);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M132",
    "guard": "the stored position is restored",
    "file": "src/enhance/position.ts",
    "old": "      place.restore(stored);",
    "new": "      void stored;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M133",
    "guard": "with no position key nothing is written",
    "file": "src/enhance/position.ts",
    "old": "  if (posKey === null) return;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M134",
    "guard": "the stored place is not written again",
    "file": "src/enhance/position.ts",
    "old": "  let last = tokenOf(stored);",
    "new": "  let last: string | null = null;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M135",
    "guard": "the same place is not written twice",
    "file": "src/enhance/position.ts",
    "old": "    if (text === last) return;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M136",
    "guard": "the place written is remembered",
    "file": "src/enhance/position.ts",
    "old": "    last = text;\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M137",
    "guard": "the place is written behind",
    "file": "src/enhance/position.ts",
    "old": "    state.writePos(posKey, now);\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M138",
    "guard": "a burst of scrolling is one wait",
    "file": "src/enhance/position.ts",
    "old": "    waiting?.(); // a burst of scrolling is one wait\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M139",
    "guard": "the write waits for scrolling to stop",
    "file": "src/enhance/position.ts",
    "old": "    waiting = env.timeout(save, SAVE_MS);",
    "new": "    save();",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M140",
    "guard": "it waits SAVE_MS",
    "file": "src/enhance/position.ts",
    "old": "const SAVE_MS = 250;",
    "new": "const SAVE_MS = 500;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M141",
    "guard": "the place is written when the page is hidden",
    "file": "src/enhance/position.ts",
    "old": "  env.onPageHide(save); // a wait still pending then finds the same place, and writes nothing\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  }
]
```

## goToHash in the lifecycle, the entry and the README: `src/enhance/lifecycle.ts`, `src/enhance/index.ts`, `README.md`, the walls test (L2-T14-M142 to L2-T14-M152)

goToHash acts only on an active instance and runs as one of its operations; the entry exports goToHash and the four option types by name; the README names goToHash and the position key; and the walls let the Viewport's own names through on env.viewport()'s answer, and nothing else on it.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T14-M142 | goToHash acts only once the instance is active | `src/enhance/lifecycle.ts` | `  if (inst === undefined \|\| inst.phase !== 'active' \|\| ctx === null) return;` → `  if (inst === undefined \|\| ctx === null) return;` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "a root not enhanced, still starting or destroyed: nothing" |
| L2-T14-M143 | goToHash runs as an operation of the instance | `src/enhance/lifecycle.ts` | `  operate(inst, () => { ⏎     ctx.nav.goToHash(id, token); ⏎   });` → `  ctx.nav.goToHash(id, token);` | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "it holds the bar; null ends a pin; a revealer that destroys the instance stops it" |
| L2-T14-M144 | the entry exports goToHash | `src/enhance/index.ts` | `export { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from` → `export { destroyEnhancement, enhance, setEnhancementPrefs } from` | `test/enhance-nav.test.ts`: 11 failed \| 37 passed (48). "goToHash is a runtime export; ChromeOptions, MermaidOptions, CommitEntry and VocabularyOptions are type exports"; "initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet's margin, by the window"; "with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head's room"; and 2 more |
| L2-T14-M145 | the entry exports ChromeOptions | `src/enhance/index.ts` | `  ChromeOptions, ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goToHash is a runtime export; ChromeOptions, MermaidOptions, CommitEntry and VocabularyOptions are type exports" |
| L2-T14-M146 | the entry exports CommitEntry | `src/enhance/index.ts` | `  CommitEntry, ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goToHash is a runtime export; ChromeOptions, MermaidOptions, CommitEntry and VocabularyOptions are type exports" |
| L2-T14-M147 | the entry exports MermaidOptions | `src/enhance/index.ts` | `  MermaidOptions, ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goToHash is a runtime export; ChromeOptions, MermaidOptions, CommitEntry and VocabularyOptions are type exports" |
| L2-T14-M148 | the entry exports VocabularyOptions | `src/enhance/index.ts` | `  VocabularyOptions, ⏎ ` → (deleted) | `test/enhance-nav.test.ts`: 1 failed \| 47 passed (48). "goToHash is a runtime export; ChromeOptions, MermaidOptions, CommitEntry and VocabularyOptions are type exports" |
| L2-T14-M149 | the README names goToHash | `README.md` | `**`goToHash(root, id, from?)`** is `onHash`'s other half` → `**`back(root, id, from?)`** is `onHash`'s other half` | `test/enhance-walls.test.ts`: 1 failed \| 13 passed (14). "names every runtime export of the entry" |
| L2-T14-M150 | the README names the position key | `README.md` | `\| `docreader:pos:<posKey>` \| The reading position of one document` → `\| `docreader:pos` \| The reading position of one document` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "names the lens pref and its values, and the reserved position and UI keys" |
| L2-T14-M151 | walls: the Viewport's names pass on env.viewport()'s answer | `test/enhance-walls.test.ts` | `if ((seam !== 'Env' && seam !== 'Viewport') \|\| ` → `if (seam !== 'Env' \|\| ` | `test/enhance-walls.test.ts`: 2 failed \| 12 passed (14). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T14-M152 | walls: the Env and Viewport exemption needs one of their types (Task 7a's M186, rewritten) | `test/enhance-walls.test.ts` | `    if ((seam !== 'Env' && seam !== 'Viewport') \|\| !(sym?.declarations ?? []).some((d) => rel(d.getSourceFile().fileName) === 'src/enhance/env.ts')) return false; ⏎ ` → (deleted) | `test/enhance-walls.test.ts`: 2 failed \| 12 passed (14). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees a destructured member, an alias named env, the other style routes, a frame's window and the clock passed on" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T14-M142",
    "guard": "goToHash acts only once the instance is active",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (inst === undefined || inst.phase !== 'active' || ctx === null) return;",
    "new": "  if (inst === undefined || ctx === null) return;",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M143",
    "guard": "goToHash runs as an operation of the instance",
    "file": "src/enhance/lifecycle.ts",
    "old": "  operate(inst, () => {\n    ctx.nav.goToHash(id, token);\n  });",
    "new": "  ctx.nav.goToHash(id, token);",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M144",
    "guard": "the entry exports goToHash",
    "file": "src/enhance/index.ts",
    "old": "export { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from",
    "new": "export { destroyEnhancement, enhance, setEnhancementPrefs } from",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M145",
    "guard": "the entry exports ChromeOptions",
    "file": "src/enhance/index.ts",
    "old": "  ChromeOptions,\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M146",
    "guard": "the entry exports CommitEntry",
    "file": "src/enhance/index.ts",
    "old": "  CommitEntry,\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M147",
    "guard": "the entry exports MermaidOptions",
    "file": "src/enhance/index.ts",
    "old": "  MermaidOptions,\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M148",
    "guard": "the entry exports VocabularyOptions",
    "file": "src/enhance/index.ts",
    "old": "  VocabularyOptions,\n",
    "new": "",
    "tests": "test/enhance-nav.test.ts"
  },
  {
    "id": "L2-T14-M149",
    "guard": "the README names goToHash",
    "file": "README.md",
    "old": "**`goToHash(root, id, from?)`** is `onHash`'s other half",
    "new": "**`back(root, id, from?)`** is `onHash`'s other half",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T14-M150",
    "guard": "the README names the position key",
    "file": "README.md",
    "old": "| `docreader:pos:<posKey>` | The reading position of one document",
    "new": "| `docreader:pos` | The reading position of one document",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T14-M151",
    "guard": "walls: the Viewport's names pass on env.viewport()'s answer",
    "file": "test/enhance-walls.test.ts",
    "old": "if ((seam !== 'Env' && seam !== 'Viewport') || ",
    "new": "if (seam !== 'Env' || ",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T14-M152",
    "guard": "walls: the Env and Viewport exemption needs one of their types (Task 7a's M186, rewritten)",
    "file": "test/enhance-walls.test.ts",
    "old": "    if ((seam !== 'Env' && seam !== 'Viewport') || !(sym?.declarations ?? []).some((d) => rel(d.getSourceFile().fileName) === 'src/enhance/env.ts')) return false;\n",
    "new": "",
    "tests": "test/enhance-walls.test.ts"
  }
]
```

## Rows of earlier tasks this task superseded

The code these rows mutate was rewritten here, so their `old` text no longer occurs. Each guard stands, and its row on
the new code is in a section above.

| Earlier row | Guard | Now |
|---|---|---|
| L2-T7a-M186 | walls: the Env exemption needs the Env type | L2-T14-M152 (the Env and Viewport exemption needs one of their types) |
| L2-T7b-M116 | byId: an element that left the root is no answer | L2-T14-M103 |
| L2-T7b-M118 | idOf: an id the instance did not read is no answer | L2-T14-M104 |
| L2-T7b-M125 | goTo holds the bar | L2-T14-M88 |
| L2-T7b-M126 | a browser without scrollIntoView skips it | L2-T14-M38 |
| L2-T7b-M127 | reduced motion scrolls at once | L2-T14-M85, and M87 in a real browser |
| L2-T7b-M128 | a target two screens away is scrolled to at once | L2-T14-M86 |
| L2-T7b-M131 | a target with no id makes no onHash | L2-T14-M89 |
| L2-T7b-M135 | a modified click on a hash link is left to the browser | L2-T14-M101: such a click now goes on to onLink when the host gave one |
| L2-T7b-M136 | a hash link with no target is left to the browser | L2-T14-M102: such a link now goes on to onLink when the host gave one |
| L2-T7b-M143 | position.keep answers what fn answers | L2-T14-M74 |
| L2-T7b-M144 | holdBar holds the bar for BAR_HOLD_MS | L2-T14-M105 |

## Visual check

The flash, and the section link on hover, against a temporary copy of the reference reader serving the same neutral
sample (`scripts/demo/samples/core.md`) from a temporary repository, on loopback; ours was the demo page
(`scripts/demo/build.mjs`) of commit `164e74b`.

`scripts/visual/compare.mjs` ran in the states light and dark and three named states, made by a scratch setup module:
`flash-light` and `flash-dark` (the paragraph's link to the second section is clicked, then every animation is paused
at its start, so the flash's first frame is measured) and `hover-light` (the pointer rests on the first numbered
section's heading), at 1440×1000 and 390×844. In each of the ten combinations 46 blocks are in both pages, and every
difference is one Task 6's run listed as expected, for parts not yet built: in every combination the front-matter
strip and the meta line, which stay in the document hidden (C43), and the gap the reference's review strip leaves
above the first section (Task 20); at 1440 px the blocks' auto margins, which resolve differently because the
reference sets its column beside its contents rail (Task 18; every box equal), 41 differences in all; at 390 px the
code block's maximum width (Task 10) and the tint on the table row that waits on the reader (Task 19), 5 in all.
Result: 0 unexpected differences in each combination, the flash and hover states included. The flashed heading's
background in the flash's first frame is `rgba(35, 85, 159, 0.09)` in light and `rgba(148, 182, 234, 0.13)` in dark,
on both pages, at both viewports.

What compare.mjs does not measure, because it carries no `data-line`, was measured by a scratch script on both pages,
in light and dark, at both viewports: the section link at rest and on hover (opacity, colour, font size, weight and
style, line height, left margin, text decoration, display, vertical alignment, generic family, its box from the
heading's origin to 0.1 px, its text, title and accessible name), and the flash's first frame (the class, the
background, the box shadow `0 0 0 8px` in the accent tint, the animation and its 1.8 s). 0 differences in each of the
four combinations. The link's markup is the reference's (`a.h-anchor`, "#", "Link to this section", "Link to Context"),
with the chrome mark beside it.
