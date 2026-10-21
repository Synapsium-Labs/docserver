# L2 Task 12: mutation rows (the bar and scrolling)

Each guard of Task 12, deleted or changed once, with the tests that go red: the scroll spy and its units, the bar's
parts in the frame (the progress line, `scrolled`, the phone bar), the running head, the measured `--bar-h`, the
bar's landmark (`src/enhance/bar.ts`), and the bar block of `assets/reader.css` in a real browser. Measured 2026-10-20
on branch `l2-t12-scroll` at commit `ce7e8dc` (the review round's fixes), every row, L2-T12-M1 to L2-T12-M91: all 91
red (`rc=1`), each through a failing assertion (none only through a file that failed to load or an unhandled error;
L2-T12-M54's two cases fail on the error the mutated build throws, inside their assertions). A first full pass, at
commit `11902e0`, had measured L2-T12-M1 to L2-T12-M79 red the same way. The review round changed three rows:
L2-T12-M11 and L2-T12-M12 take the code as it now reads (each unit once; a unit folded or with no box), and L2-T12-M4
also runs the browser file, so RF3's in-page count is seen red too.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a 512 MiB
output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict) and the one Task
7b added, which changes only what it prints (it also keeps vitest's `Errors` count line and `Unhandled` and
`TypeError` lines). Each row is applied to its own throwaway copy of the working tree (tracked and untracked files,
never ignored ones, `node_modules` linked from the checkout), its test file runs there with the local `vitest`, and
the copy is deleted. Each `old` occurs exactly once in its file. The rows ran one at a time, in sequential batches,
with `DOCREADER_BROWSERS=chromium` (C45): the browser rows ran in Chromium, and WebKit was reported as excluded; no
row is WebKit-only, and every browser case is green in WebKit too, in the Playwright image (C51). The checkout was
never edited: `git status --porcelain` read the same before and after each pass (empty on the first; on the second
only this file, not yet committed), and so did the hash of `git diff` and `HEAD`. The Red column gives the count line
and the failing tests the run printed (at most five here).

Notes on the measurement.
- A first pass, on the code before the round's last commits, left three rows green and one red only through a broken
  mutation; each got a case or a fix before this pass. The row that keeps the phone bar's 28 px gap was green because,
  at the top of a page, a sticky bar placed above the root's edge is pushed down to the window's top all the same: the
  first browser case now puts a host's own 100 px header above the root, where the bar must sit at the root's top
  edge. The row that writes `bar-hidden` on every frame was green because a phone's frame calls the write only when the
  reader moves: the case now measures a wider window's repeated frame, which does call it. The row that dropped the
  number for "In short" was green because "In short" never carries a number: the running head now decides "In short"
  once, for the number and the title alike (one row). The row for the units' document order first left an unbalanced
  parenthesis (the test file did not load); it now drops the whole sort.
- The row that writes the running head without the bar first went red only through an unhandled `TypeError` in a frame;
  the case without the bar now collects the window's errors and asserts there are none, so it is red on an assertion.
- Before measuring, checks no case could redden were dropped rather than left unmeasured (C49, C52): the chrome mark on
  `.short` and `.sec-no` (render() writes no class, so only the layout makes either), the h3-and-id filter on task
  headings (an h2 task heading is its section's own, a unit already, and every heading render() makes has an id), the
  white-space squashing of labels the layout already squashed, an empty title's check, and the plan condition on the
  hidden-unit filter (no section heading is ever hidden). The commits say which.

## The scroll spy: `src/enhance/scroll.ts` (L2-T12-M1 to L2-T12-M22)

The reading line and its strict edge, the binary search (RF3), the read-mark units (the outline mode, the sections
that hold tasks, "In short", a page that is not a document, document order, hidden units and their relayout), the spy
event (once per change, a unit alone, frozen, the live check on the frame), the spy after every relayout, and one
frame per burst of scroll events.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M1 | the reading line is at least LINE_MIN px | `src/enhance/scroll.ts` | `const line = Math.max(LINE_MIN, vh * LINE_SHARE);` → `const line = vh * LINE_SHARE;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the reading line is at least 150 px on a short window" |
| L2-T12-M2 | the reading line is LINE_SHARE of the window | `src/enhance/scroll.ts` | `const line = Math.max(LINE_MIN, vh * LINE_SHARE);` → `const line = Math.max(LINE_MIN, vh * 0.5);` | `test/enhance-scroll.test.ts`: 3 failed \| 32 passed (35). "the reading line is at least 150 px on a short window"; "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "the spy reads at most 2⌈log₂ n⌉ + 4 rects a frame, and finds the same section a scan from the top would" |
| L2-T12-M3 | a heading on the line is not above it (strict) | `src/enhance/scroll.ts` | `.getBoundingClientRect().top < line) lo = mid + 1;` → `.getBoundingClientRect().top <= line) lo = mid + 1;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the reading line is at least 150 px on a short window" |
| L2-T12-M4 | the search is a binary search (RF3: rect reads per frame O(log n)) | `src/enhance/scroll.ts` | `  let lo = 0; ⏎   let hi = list.length; ⏎   while (lo < hi) { ⏎     const mid = (lo + hi) >>> 1; ⏎  …` → `  let found = -1; ⏎   for (let i = 0; i < list.length; i += 1) { ⏎     if ((list[i] as Element).getB…` | `test/enhance-scroll.test.ts` and `test/browser/scroll.test.ts`: 5 failed \| 39 passed \| 9 skipped (53). "the spy reads at most 2⌈log₂ n⌉ + 4 rects a frame, and finds the same section a scan from the top would"; "without tasks a relayout's frame stays within the bound too: no unit's box is read for a search that never runs"; "on a plan, both searches together stay within the bound"; "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held"; "RF3: on the large plan, the rect reads of a frame stay at or below 2⌈log₂ n⌉ + 4, counted in the page" |
| L2-T12-M5 | the search narrows past a heading below the line exactly (hi = mid) | `src/enhance/scroll.ts` | `    else hi = mid; ⏎ ` → `    else hi = mid - 1 > lo ? mid - 1 : mid; ⏎ ` | `test/enhance-scroll.test.ts`: 11 failed \| 24 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "a unit with no box (a task's part the outline mode leaves out) is left out of the search once relayout ran"; "a host's hidden attribute above the root is no fold: its units are searched once the host shows it"; "a root with no box when relayout ran (in a host's hidden panel) finds its units at the first frame it has one" |
| L2-T12-M6 | the search answers the last heading above the line (lo - 1) | `src/enhance/scroll.ts` | `  return lo - 1; ⏎ }` → `  return lo > 0 ? lo - 1 : lo; ⏎ }` | `test/enhance-scroll.test.ts`: 4 failed \| 31 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "the reading line is at least 150 px on a short window"; "a page that is not a document has sections but no units"; "the spy reads at most 2⌈log₂ n⌉ + 4 rects a frame, and finds the same section a scan from the top would" |
| L2-T12-M7 | task headings are units only on a plan that takes the outline mode | `src/enhance/scroll.ts` | `const tasks = ctx.plan.outlineable ? ctx.plan.tasks : [];` → `const tasks = ctx.plan.tasks;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "on a plan too short for the outline mode, the tasks are no units: the section that holds them is" |
| L2-T12-M8 | a section whose members hold a task is no unit | `src/enhance/scroll.ts` | `!(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])` → `!(heads.get(h)?.inShort ?? false)), ...tasks])` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran" |
| L2-T12-M9 | "In short" is no unit | `src/enhance/scroll.ts` | `!(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])` → `!holders.has(h)), ...tasks])` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "the reading line is at least 150 px on a short window" |
| L2-T12-M10 | a page that is not a document has no units | `src/enhance/scroll.ts` | `  const units: readonly HTMLElement[] = ctx.info.isDocument ⏎ ` → `  const units: readonly HTMLElement[] = true ⏎ ` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a page that is not a document has sections but no units" |
| L2-T12-M11 | the units are in document order | `src/enhance/scroll.ts` | `ctx.text.inOrder([...new Set([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holder…` → `[...new Set([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tas…` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "a unit with no box (a task's part the outline mode leaves out) is left out of the search once relayout ran" |
| L2-T12-M12 | a folded or boxless unit is left out of the search | `src/enhance/scroll.ts` | `shown = units.filter((u) => !folded(u, root) && u.getClientRects().length > 0);` → `shown = units;` | `test/enhance-scroll.test.ts`: 3 failed \| 32 passed (35). "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "a unit with no box (a task's part the outline mode leaves out) is left out of the search once relayout ran"; "a root with no box when relayout ran (in a host's hidden panel) finds its units at the first frame it has one" |
| L2-T12-M13 | the hidden units are found again at every relayout | `src/enhance/scroll.ts` | `  events.on('relayout', () => { ⏎     reshow(); ⏎     spy();` → `  events.on('relayout', () => { ⏎     spy();` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "a unit with no box (a task's part the outline mode leaves out) is left out of the search once relayout ran" |
| L2-T12-M14 | without tasks the unit is the section, with no search of its own | `src/enhance/scroll.ts` | `    if (tasks.length > 0) u = shown[lastAbove(shown, line)] ?? null;` → `    if (true) u = shown[lastAbove(shown, line)] ?? null;` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the spy reads at most 2⌈log₂ n⌉ + 4 rects a frame, and finds the same section a scan from the top would"; "without tasks a relayout's frame stays within the bound too: no unit's box is read for a search that never runs" |
| L2-T12-M15 | without tasks a section is the unit only when it is one | `src/enhance/scroll.ts` | `    else u = sec !== null && isUnit.has(sec) ? sec : null;` → `    else u = sec;` | `test/enhance-scroll.test.ts`: 3 failed \| 32 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "the reading line is at least 150 px on a short window"; "a page that is not a document has sections but no units" |
| L2-T12-M16 | a spy event only when the section or the unit changes | `src/enhance/scroll.ts` | `    if (sec !== section \|\| u !== unit) {` → `    if (true) {` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "on a plan too short for the outline mode, the tasks are no units: the section that holds them is" |
| L2-T12-M17 | a change of unit alone is a spy event | `src/enhance/scroll.ts` | `    if (sec !== section \|\| u !== unit) {` → `    if (sec !== section) {` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "on a plan, both searches together stay within the bound" |
| L2-T12-M18 | the spy payload is frozen | `src/enhance/scroll.ts` | `events.emit('spy', Object.freeze({ section: sec, unit: u }));` → `events.emit('spy', { section: sec, unit: u });` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen" |
| L2-T12-M19 | the live check on the frame: a listener that destroyed the instance stops it | `src/enhance/scroll.ts` | `      if (!ctx.live()) return; // a listener destroyed the instance ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a spy listener that destroys the instance stops the frame: the running head is not written after it" |
| L2-T12-M20 | the spy runs after every relayout (the first frame included), with no scroll | `src/enhance/scroll.ts` | `  events.on('relayout', () => { ⏎     reshow(); ⏎     spy(); ⏎   });` → `  events.on('relayout', () => { ⏎     reshow(); ⏎   });` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the spy runs at the first frame and after every relayout, with no scroll"; "without tasks a relayout's frame stays within the bound too: no unit's box is read for a search that never runs" |
| L2-T12-M21 | a burst of scroll events asks for one frame | `src/enhance/scroll.ts` | `    if (ticking) return; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a burst of scroll events asks for one frame" |
| L2-T12-M22 | a frame lets the next scroll ask for a frame | `src/enhance/scroll.ts` | `    ticking = false; ⏎     const vh = env.viewport().h;` → `    const vh = env.viewport().h;` | `test/enhance-scroll.test.ts`: 17 failed \| 18 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "the reading line is at least 150 px on a short window"; "on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran"; "on a plan whose tasks are h2 headings, each is one unit: no frame reads a heading twice in one search"; "a unit with no box (a task's part the outline mode leaves out) is left out of the search once relayout ran" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M1",
    "guard": "the reading line is at least LINE_MIN px",
    "file": "src/enhance/scroll.ts",
    "old": "const line = Math.max(LINE_MIN, vh * LINE_SHARE);",
    "new": "const line = vh * LINE_SHARE;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M2",
    "guard": "the reading line is LINE_SHARE of the window",
    "file": "src/enhance/scroll.ts",
    "old": "const line = Math.max(LINE_MIN, vh * LINE_SHARE);",
    "new": "const line = Math.max(LINE_MIN, vh * 0.5);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M3",
    "guard": "a heading on the line is not above it (strict)",
    "file": "src/enhance/scroll.ts",
    "old": ".getBoundingClientRect().top < line) lo = mid + 1;",
    "new": ".getBoundingClientRect().top <= line) lo = mid + 1;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M4",
    "guard": "the search is a binary search (RF3: rect reads per frame O(log n))",
    "file": "src/enhance/scroll.ts",
    "old": "  let lo = 0;\n  let hi = list.length;\n  while (lo < hi) {\n    const mid = (lo + hi) >>> 1;\n    if ((list[mid] as Element).getBoundingClientRect().top < line) lo = mid + 1;\n    else hi = mid;\n  }\n  return lo - 1;",
    "new": "  let found = -1;\n  for (let i = 0; i < list.length; i += 1) {\n    if ((list[i] as Element).getBoundingClientRect().top < line) found = i;\n    else break;\n  }\n  return found;",
    "tests": "test/enhance-scroll.test.ts test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M5",
    "guard": "the search narrows past a heading below the line exactly (hi = mid)",
    "file": "src/enhance/scroll.ts",
    "old": "    else hi = mid;\n",
    "new": "    else hi = mid - 1 > lo ? mid - 1 : mid;\n",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M6",
    "guard": "the search answers the last heading above the line (lo - 1)",
    "file": "src/enhance/scroll.ts",
    "old": "  return lo - 1;\n}",
    "new": "  return lo > 0 ? lo - 1 : lo;\n}",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M7",
    "guard": "task headings are units only on a plan that takes the outline mode",
    "file": "src/enhance/scroll.ts",
    "old": "const tasks = ctx.plan.outlineable ? ctx.plan.tasks : [];",
    "new": "const tasks = ctx.plan.tasks;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M8",
    "guard": "a section whose members hold a task is no unit",
    "file": "src/enhance/scroll.ts",
    "old": "!(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])",
    "new": "!(heads.get(h)?.inShort ?? false)), ...tasks])",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M9",
    "guard": "\"In short\" is no unit",
    "file": "src/enhance/scroll.ts",
    "old": "!(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])",
    "new": "!holders.has(h)), ...tasks])",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M10",
    "guard": "a page that is not a document has no units",
    "file": "src/enhance/scroll.ts",
    "old": "  const units: readonly HTMLElement[] = ctx.info.isDocument\n",
    "new": "  const units: readonly HTMLElement[] = true\n",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M11",
    "guard": "the units are in document order",
    "file": "src/enhance/scroll.ts",
    "old": "ctx.text.inOrder([...new Set([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])])",
    "new": "[...new Set([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])]",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M12",
    "guard": "a folded or boxless unit is left out of the search",
    "file": "src/enhance/scroll.ts",
    "old": "shown = units.filter((u) => !folded(u, root) && u.getClientRects().length > 0);",
    "new": "shown = units;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M13",
    "guard": "the hidden units are found again at every relayout",
    "file": "src/enhance/scroll.ts",
    "old": "  events.on('relayout', () => {\n    reshow();\n    spy();",
    "new": "  events.on('relayout', () => {\n    spy();",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M14",
    "guard": "without tasks the unit is the section, with no search of its own",
    "file": "src/enhance/scroll.ts",
    "old": "    if (tasks.length > 0) u = shown[lastAbove(shown, line)] ?? null;",
    "new": "    if (true) u = shown[lastAbove(shown, line)] ?? null;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M15",
    "guard": "without tasks a section is the unit only when it is one",
    "file": "src/enhance/scroll.ts",
    "old": "    else u = sec !== null && isUnit.has(sec) ? sec : null;",
    "new": "    else u = sec;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M16",
    "guard": "a spy event only when the section or the unit changes",
    "file": "src/enhance/scroll.ts",
    "old": "    if (sec !== section || u !== unit) {",
    "new": "    if (true) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M17",
    "guard": "a change of unit alone is a spy event",
    "file": "src/enhance/scroll.ts",
    "old": "    if (sec !== section || u !== unit) {",
    "new": "    if (sec !== section) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M18",
    "guard": "the spy payload is frozen",
    "file": "src/enhance/scroll.ts",
    "old": "events.emit('spy', Object.freeze({ section: sec, unit: u }));",
    "new": "events.emit('spy', { section: sec, unit: u });",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M19",
    "guard": "the live check on the frame: a listener that destroyed the instance stops it",
    "file": "src/enhance/scroll.ts",
    "old": "      if (!ctx.live()) return; // a listener destroyed the instance\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M20",
    "guard": "the spy runs after every relayout (the first frame included), with no scroll",
    "file": "src/enhance/scroll.ts",
    "old": "  events.on('relayout', () => {\n    reshow();\n    spy();\n  });",
    "new": "  events.on('relayout', () => {\n    reshow();\n  });",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M21",
    "guard": "a burst of scroll events asks for one frame",
    "file": "src/enhance/scroll.ts",
    "old": "    if (ticking) return;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M22",
    "guard": "a frame lets the next scroll ask for a frame",
    "file": "src/enhance/scroll.ts",
    "old": "    ticking = false;\n    const vh = env.viewport().h;",
    "new": "    const vh = env.viewport().h;",
    "tests": "test/enhance-scroll.test.ts"
  }
]
```

## The bar in the frame: the progress line, `scrolled` and the phone bar (L2-T12-M23 to L2-T12-M43)

The bar parts only with the bar; the progress share and its bounds, rounding and write; `scrolled` with and without a
title; the phone bar (a wider window, the 700 px query, a held bar, a dialog, the day view, the slack and the 300 px
edge both ways, the last position) and its write.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M23 | the bar parts are written only with the bar | `src/enhance/scroll.ts` | `    if (slots !== null) { ⏎       const box = root.getBoundingClientRect();` → `    if (true) { ⏎       const box = root.getBoundingClientRect();` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "spy events come without the bar too (chrome.bar false), and no bar rect is read" |
| L2-T12-M24 | the progress share is 0 when nothing can be scrolled | `src/enhance/scroll.ts` | `const share = room > 0 ? Math.min(100, Math.max(0, (100 * y) / room)) : 0;` → `const share = Math.min(100, Math.max(0, (100 * y) / room));` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits" |
| L2-T12-M25 | the progress share is at least 0 | `src/enhance/scroll.ts` | `Math.min(100, Math.max(0, (100 * y) / room))` → `Math.min(100, (100 * y) / room)` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits" |
| L2-T12-M26 | the progress share is at most 100 | `src/enhance/scroll.ts` | `Math.min(100, Math.max(0, (100 * y) / room))` → `Math.max(0, (100 * y) / room)` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits" |
| L2-T12-M27 | the progress width is rounded to a thousandth of a percent | `src/enhance/scroll.ts` | `String(Math.round(share * 1000) / 1000)` → `String(share)` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits" |
| L2-T12-M28 | the progress width is written only when it changes | `src/enhance/scroll.ts` | `      if (w !== width) { ⏎ ` → `      if (true) { ⏎ ` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the same place twice: no style, class or running head write the second time" |
| L2-T12-M29 | the title counts as scrolled past only above 40 px | `src/enhance/scroll.ts` | `.getBoundingClientRect().bottom < TITLE_GONE` → `.getBoundingClientRect().bottom <= TITLE_GONE` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "scrolled: once the title's bottom is above 40 px; without a title, once the root is 80 px past the top" |
| L2-T12-M30 | scrolled reads the title when there is one | `src/enhance/scroll.ts` | `const past = h1 !== null ? h1.getBoundingClientRect().bottom < TITLE_GONE : y > SCROLLED_NO_TITLE;` → `const past = y > SCROLLED_NO_TITLE;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "scrolled: once the title's bottom is above 40 px; without a title, once the root is 80 px past the top" |
| L2-T12-M31 | with no title, scrolled only past 80 px | `src/enhance/scroll.ts` | `: y > SCROLLED_NO_TITLE;` → `: y >= SCROLLED_NO_TITLE;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "scrolled: once the title's bottom is above 40 px; without a title, once the root is 80 px past the top" |
| L2-T12-M32 | scrolled is written only when it changes | `src/enhance/scroll.ts` | `      if (past !== scrolled) { ⏎ ` → `      if (true) { ⏎ ` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the same place twice: no style, class or running head write the second time" |
| L2-T12-M33 | a wider window never hides the bar | `src/enhance/scroll.ts` | `      if (!env.matches('(max-width: 700px)')) hide(false); ⏎       else if (position.barHeld()) hide…` → `      if (position.barHeld()) hide(false);` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "never hidden on a wider window: it shows again when the window widens"; "the same place twice: no style, class or running head write the second time" |
| L2-T12-M34 | the phone is a window of at most 700 px | `src/enhance/scroll.ts` | `env.matches('(max-width: 700px)')` → `env.matches('(max-width: 600px)')` | `test/enhance-scroll.test.ts`: 5 failed \| 30 passed (35). "hides when scrolling down past 300 px, and returns on scrolling up, or near the top"; "stays while a dialog is open or the day view is on; a held bar shows"; "a card (a preview, not a dialog) does not keep the bar"; "never hidden on a wider window: it shows again when the window widens"; "the same place twice: no style, class or running head write the second time" |
| L2-T12-M35 | a held bar shows | `src/enhance/scroll.ts` | `      else if (position.barHeld()) hide(false); ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "stays while a dialog is open or the day view is on; a held bar shows" |
| L2-T12-M36 | a dialog keeps the bar as it is | `src/enhance/scroll.ts` | `      else if (!overlays.any() && !root.classList.contains(DAY_VIEW)) {` → `      else if (!root.classList.contains(DAY_VIEW)) {` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "stays while a dialog is open or the day view is on; a held bar shows" |
| L2-T12-M37 | the day view keeps the bar as it is | `src/enhance/scroll.ts` | `      else if (!overlays.any() && !root.classList.contains(DAY_VIEW)) {` → `      else if (!overlays.any()) {` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "stays while a dialog is open or the day view is on; a held bar shows" |
| L2-T12-M38 | the bar hides only on a scroll down past the slack | `src/enhance/scroll.ts` | `if (y > lastY + SCROLL_SLACK && y > HIDE_AFTER) hide(true);` → `if (y > lastY && y > HIDE_AFTER) hide(true);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "hides when scrolling down past 300 px, and returns on scrolling up, or near the top" |
| L2-T12-M39 | the bar hides only past 300 px | `src/enhance/scroll.ts` | `if (y > lastY + SCROLL_SLACK && y > HIDE_AFTER) hide(true);` → `if (y > lastY + SCROLL_SLACK) hide(true);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "hides when scrolling down past 300 px, and returns on scrolling up, or near the top" |
| L2-T12-M40 | the bar shows only on a scroll up past the slack | `src/enhance/scroll.ts` | `else if (y < lastY - SCROLL_SLACK \|\| y < HIDE_AFTER) hide(false);` → `else if (y < lastY \|\| y < HIDE_AFTER) hide(false);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "hides when scrolling down past 300 px, and returns on scrolling up, or near the top" |
| L2-T12-M41 | the bar shows above 300 px | `src/enhance/scroll.ts` | `else if (y < lastY - SCROLL_SLACK \|\| y < HIDE_AFTER) hide(false);` → `else if (y < lastY - SCROLL_SLACK) hide(false);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "hides when scrolling down past 300 px, and returns on scrolling up, or near the top" |
| L2-T12-M42 | each frame remembers its scroll position | `src/enhance/scroll.ts` | `      lastY = y; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "hides when scrolling down past 300 px, and returns on scrolling up, or near the top"; "stays while a dialog is open or the day view is on; a held bar shows" |
| L2-T12-M43 | bar-hidden is written only when it changes | `src/enhance/scroll.ts` | `    if (on === hidden) return; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the same place twice: no style, class or running head write the second time" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M23",
    "guard": "the bar parts are written only with the bar",
    "file": "src/enhance/scroll.ts",
    "old": "    if (slots !== null) {\n      const box = root.getBoundingClientRect();",
    "new": "    if (true) {\n      const box = root.getBoundingClientRect();",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M24",
    "guard": "the progress share is 0 when nothing can be scrolled",
    "file": "src/enhance/scroll.ts",
    "old": "const share = room > 0 ? Math.min(100, Math.max(0, (100 * y) / room)) : 0;",
    "new": "const share = Math.min(100, Math.max(0, (100 * y) / room));",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M25",
    "guard": "the progress share is at least 0",
    "file": "src/enhance/scroll.ts",
    "old": "Math.min(100, Math.max(0, (100 * y) / room))",
    "new": "Math.min(100, (100 * y) / room)",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M26",
    "guard": "the progress share is at most 100",
    "file": "src/enhance/scroll.ts",
    "old": "Math.min(100, Math.max(0, (100 * y) / room))",
    "new": "Math.max(0, (100 * y) / room)",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M27",
    "guard": "the progress width is rounded to a thousandth of a percent",
    "file": "src/enhance/scroll.ts",
    "old": "String(Math.round(share * 1000) / 1000)",
    "new": "String(share)",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M28",
    "guard": "the progress width is written only when it changes",
    "file": "src/enhance/scroll.ts",
    "old": "      if (w !== width) {\n",
    "new": "      if (true) {\n",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M29",
    "guard": "the title counts as scrolled past only above 40 px",
    "file": "src/enhance/scroll.ts",
    "old": ".getBoundingClientRect().bottom < TITLE_GONE",
    "new": ".getBoundingClientRect().bottom <= TITLE_GONE",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M30",
    "guard": "scrolled reads the title when there is one",
    "file": "src/enhance/scroll.ts",
    "old": "const past = h1 !== null ? h1.getBoundingClientRect().bottom < TITLE_GONE : y > SCROLLED_NO_TITLE;",
    "new": "const past = y > SCROLLED_NO_TITLE;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M31",
    "guard": "with no title, scrolled only past 80 px",
    "file": "src/enhance/scroll.ts",
    "old": ": y > SCROLLED_NO_TITLE;",
    "new": ": y >= SCROLLED_NO_TITLE;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M32",
    "guard": "scrolled is written only when it changes",
    "file": "src/enhance/scroll.ts",
    "old": "      if (past !== scrolled) {\n",
    "new": "      if (true) {\n",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M33",
    "guard": "a wider window never hides the bar",
    "file": "src/enhance/scroll.ts",
    "old": "      if (!env.matches('(max-width: 700px)')) hide(false);\n      else if (position.barHeld()) hide(false);",
    "new": "      if (position.barHeld()) hide(false);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M34",
    "guard": "the phone is a window of at most 700 px",
    "file": "src/enhance/scroll.ts",
    "old": "env.matches('(max-width: 700px)')",
    "new": "env.matches('(max-width: 600px)')",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M35",
    "guard": "a held bar shows",
    "file": "src/enhance/scroll.ts",
    "old": "      else if (position.barHeld()) hide(false);\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M36",
    "guard": "a dialog keeps the bar as it is",
    "file": "src/enhance/scroll.ts",
    "old": "      else if (!overlays.any() && !root.classList.contains(DAY_VIEW)) {",
    "new": "      else if (!root.classList.contains(DAY_VIEW)) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M37",
    "guard": "the day view keeps the bar as it is",
    "file": "src/enhance/scroll.ts",
    "old": "      else if (!overlays.any() && !root.classList.contains(DAY_VIEW)) {",
    "new": "      else if (!overlays.any()) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M38",
    "guard": "the bar hides only on a scroll down past the slack",
    "file": "src/enhance/scroll.ts",
    "old": "if (y > lastY + SCROLL_SLACK && y > HIDE_AFTER) hide(true);",
    "new": "if (y > lastY && y > HIDE_AFTER) hide(true);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M39",
    "guard": "the bar hides only past 300 px",
    "file": "src/enhance/scroll.ts",
    "old": "if (y > lastY + SCROLL_SLACK && y > HIDE_AFTER) hide(true);",
    "new": "if (y > lastY + SCROLL_SLACK) hide(true);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M40",
    "guard": "the bar shows only on a scroll up past the slack",
    "file": "src/enhance/scroll.ts",
    "old": "else if (y < lastY - SCROLL_SLACK || y < HIDE_AFTER) hide(false);",
    "new": "else if (y < lastY || y < HIDE_AFTER) hide(false);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M41",
    "guard": "the bar shows above 300 px",
    "file": "src/enhance/scroll.ts",
    "old": "else if (y < lastY - SCROLL_SLACK || y < HIDE_AFTER) hide(false);",
    "new": "else if (y < lastY - SCROLL_SLACK) hide(false);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M42",
    "guard": "each frame remembers its scroll position",
    "file": "src/enhance/scroll.ts",
    "old": "      lastY = y;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M43",
    "guard": "bar-hidden is written only when it changes",
    "file": "src/enhance/scroll.ts",
    "old": "    if (on === hidden) return;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  }
]
```

## The running head (L2-T12-M44 to L2-T12-M53)

Made with the bar holding the title, written only with the bar, "In short" and its box, the number from `span.sec-no`,
no number without one, a heading the layout named, chrome left out, the leading number left out of the title, and the
write only on a change.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M44 | the running head is made with the bar, holding the title | `src/enhance/scroll.ts` | `  if (slots !== null) slots.running.replaceChildren(doc.createTextNode(title)); ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 3 failed \| 32 passed (35). "shows the title before the first section and in "In short", then "§ n" and the section's title"; "a title the host gives is the running head's; a number is the heading's own, its title read without the chrome"; "a spy listener that destroys the instance stops the frame: the running head is not written after it" |
| L2-T12-M45 | the running head is written only with the bar | `src/enhance/scroll.ts` | `    if (slots === null) return; ⏎     // The section's own number` → `    // The section's own number` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "spy events come without the bar too (chrome.bar false), and no bar rect is read" |
| L2-T12-M46 | "In short" shows the title, not its number and name | `src/enhance/scroll.ts` | `    const own = cur !== undefined && !cur.inShort ? cur : null;` → `    const own = cur !== undefined ? cur : null;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "shows the title before the first section and in "In short", then "§ n" and the section's title" |
| L2-T12-M47 | "In short" is the section inside the layout's div.short | `src/enhance/scroll.ts` | `    if (n.classList.contains('short')) return true; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 3 failed \| 32 passed (35). "the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen"; "the reading line is at least 150 px on a short window"; "shows the title before the first section and in "In short", then "§ n" and the section's title" |
| L2-T12-M48 | the number is the heading's span.sec-no | `src/enhance/scroll.ts` | `    if (c.classList.contains('sec-no')) {` → `    if (false) {` | `test/enhance-scroll.test.ts`: 6 failed \| 29 passed (35). "a host's class "short" on the root makes no section "In short": the units and the running head are as without it"; "the spy runs at the first frame and after every relayout, with no scroll"; "shows the title before the first section and in "In short", then "§ n" and the section's title"; "a title the host gives is the running head's; a number is the heading's own, its title read without the chrome"; "a section heading the layout named keeps that name; chrome the layout put in a heading is left out" |
| L2-T12-M49 | no number, no "§" | `src/enhance/scroll.ts` | `...(no === null ? [] : [chrome(doc, 'b', { text: `§ ${no}` })])` → `chrome(doc, 'b', { text: `§ ${String(no)}` })` | `test/enhance-scroll.test.ts`: 3 failed \| 32 passed (35). "shows the title before the first section and in "In short", then "§ n" and the section's title"; "a heading whose number is not its own text keeps it in the title, as a label without a number"; "a section heading the layout named keeps that name; chrome the layout put in a heading is left out" |
| L2-T12-M50 | a heading the layout named keeps that name | `src/enhance/scroll.ts` | `  const label = h.getAttribute('aria-label') ?? headingText(h, isChrome);` → `  const label = headingText(h, isChrome);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a section heading the layout named keeps that name; chrome the layout put in a heading is left out" |
| L2-T12-M51 | a heading's title leaves the layout's chrome out | `src/enhance/scroll.ts` | `  const label = h.getAttribute('aria-label') ?? headingText(h, isChrome);` → `  const label = h.getAttribute('aria-label') ?? headingText(h, () => false);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a section heading the layout named keeps that name; chrome the layout put in a heading is left out" |
| L2-T12-M52 | the title leaves a leading number out | `src/enhance/scroll.ts` | `title: label.replace(SEC_NO, '')` → `title: label` | `test/enhance-scroll.test.ts`: 7 failed \| 28 passed (35). "a host's class "short" on the root makes no section "In short": the units and the running head are as without it"; "the spy runs at the first frame and after every relayout, with no scroll"; "shows the title before the first section and in "In short", then "§ n" and the section's title"; "a title the host gives is the running head's; a number is the heading's own, its title read without the chrome"; "a heading whose number is not its own text keeps it in the title, as a label without a number" |
| L2-T12-M53 | the running head is written only when it changes | `src/enhance/scroll.ts` | `    if (key === running) return; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the same place twice: no style, class or running head write the second time" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M44",
    "guard": "the running head is made with the bar, holding the title",
    "file": "src/enhance/scroll.ts",
    "old": "  if (slots !== null) slots.running.replaceChildren(doc.createTextNode(title));\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M45",
    "guard": "the running head is written only with the bar",
    "file": "src/enhance/scroll.ts",
    "old": "    if (slots === null) return;\n    // The section's own number",
    "new": "    // The section's own number",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M46",
    "guard": "\"In short\" shows the title, not its number and name",
    "file": "src/enhance/scroll.ts",
    "old": "    const own = cur !== undefined && !cur.inShort ? cur : null;",
    "new": "    const own = cur !== undefined ? cur : null;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M47",
    "guard": "\"In short\" is the section inside the layout's div.short",
    "file": "src/enhance/scroll.ts",
    "old": "    if (n.classList.contains('short')) return true;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M48",
    "guard": "the number is the heading's span.sec-no",
    "file": "src/enhance/scroll.ts",
    "old": "    if (c.classList.contains('sec-no')) {",
    "new": "    if (false) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M49",
    "guard": "no number, no \"§\"",
    "file": "src/enhance/scroll.ts",
    "old": "...(no === null ? [] : [chrome(doc, 'b', { text: `§ ${no}` })])",
    "new": "chrome(doc, 'b', { text: `§ ${String(no)}` })",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M50",
    "guard": "a heading the layout named keeps that name",
    "file": "src/enhance/scroll.ts",
    "old": "  const label = h.getAttribute('aria-label') ?? headingText(h, isChrome);",
    "new": "  const label = headingText(h, isChrome);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M51",
    "guard": "a heading's title leaves the layout's chrome out",
    "file": "src/enhance/scroll.ts",
    "old": "  const label = h.getAttribute('aria-label') ?? headingText(h, isChrome);",
    "new": "  const label = h.getAttribute('aria-label') ?? headingText(h, () => false);",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M52",
    "guard": "the title leaves a leading number out",
    "file": "src/enhance/scroll.ts",
    "old": "title: label.replace(SEC_NO, '')",
    "new": "title: label",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M53",
    "guard": "the running head is written only when it changes",
    "file": "src/enhance/scroll.ts",
    "old": "    if (key === running) return;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  }
]
```

## The measured `--bar-h` (L2-T12-M54 to L2-T12-M60)

Only with the bar; the bar's padding left out, top and bottom; a whole number; a bar that is not laid out; a write
only when it differs; a padding the window cannot read.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M54 | --bar-h is measured only with the bar | `src/enhance/scroll.ts` | `  if (slots === null) return; ⏎   const bar = slots.bar;` → `  const bar = (slots as unknown as { bar: HTMLElement }).bar;` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "spy events come without the bar too (chrome.bar false), and no bar rect is read"; "no --bar-h without the bar" |
| L2-T12-M55 | --bar-h leaves the bar's bottom padding out | `src/enhance/scroll.ts` | ` - px(env.computed(bar, 'padding-bottom')));` → `);` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "--bar-h is the bar's measured height without its padding, written on the root only when it differs" |
| L2-T12-M56 | --bar-h leaves the bar's top padding out | `src/enhance/scroll.ts` | ` - px(env.computed(bar, 'padding-top'))` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "--bar-h is the bar's measured height without its padding, written on the root only when it differs" |
| L2-T12-M57 | --bar-h is a whole number of pixels | `src/enhance/scroll.ts` | `    const h = Math.round(bar.clientHeight` → `    const h = (bar.clientHeight` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "--bar-h is the bar's measured height without its padding, written on the root only when it differs" |
| L2-T12-M58 | a bar that is not laid out measures nothing | `src/enhance/scroll.ts` | `    if (!(h > 0)) return; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "--bar-h is the bar's measured height without its padding, written on the root only when it differs" |
| L2-T12-M59 | --bar-h is written only when it differs from what the root holds | `src/enhance/scroll.ts` | `    if (Math.abs(parseFloat(env.computed(root, '--bar-h')) - h) < 0.5) return; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "--bar-h is the bar's measured height without its padding, written on the root only when it differs" |
| L2-T12-M60 | a padding the window cannot read counts as none | `src/enhance/scroll.ts` | `  return Number.isFinite(n) ? n : 0;` → `  return n;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a padding the window cannot read counts as none" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M54",
    "guard": "--bar-h is measured only with the bar",
    "file": "src/enhance/scroll.ts",
    "old": "  if (slots === null) return;\n  const bar = slots.bar;",
    "new": "  const bar = (slots as unknown as { bar: HTMLElement }).bar;",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M55",
    "guard": "--bar-h leaves the bar's bottom padding out",
    "file": "src/enhance/scroll.ts",
    "old": " - px(env.computed(bar, 'padding-bottom')));",
    "new": ");",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M56",
    "guard": "--bar-h leaves the bar's top padding out",
    "file": "src/enhance/scroll.ts",
    "old": " - px(env.computed(bar, 'padding-top'))",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M57",
    "guard": "--bar-h is a whole number of pixels",
    "file": "src/enhance/scroll.ts",
    "old": "    const h = Math.round(bar.clientHeight",
    "new": "    const h = (bar.clientHeight",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M58",
    "guard": "a bar that is not laid out measures nothing",
    "file": "src/enhance/scroll.ts",
    "old": "    if (!(h > 0)) return;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M59",
    "guard": "--bar-h is written only when it differs from what the root holds",
    "file": "src/enhance/scroll.ts",
    "old": "    if (Math.abs(parseFloat(env.computed(root, '--bar-h')) - h) < 0.5) return;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M60",
    "guard": "a padding the window cannot read counts as none",
    "file": "src/enhance/scroll.ts",
    "old": "  return Number.isFinite(n) ? n : 0;",
    "new": "  return n;",
    "tests": "test/enhance-scroll.test.ts"
  }
]
```

## The bar's landmark: `src/enhance/bar.ts` (L2-T12-M61 to L2-T12-M63)

No landmark while the tray is empty; the first tool makes it a labelled navigation landmark.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M61 | the bar is no landmark while its tray is empty | `src/enhance/bar.ts` | `chrome(doc, 'nav', { className: 'topbar', attrs: { role: 'none' } },` → `chrome(doc, 'nav', { className: 'topbar' },` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the bar is no landmark while its tray is empty; its first tool makes it a labelled navigation landmark"; "in a reader: a tool put in the tray during the build makes the bar a labelled landmark" |
| L2-T12-M62 | the first tool makes the bar a navigation landmark | `src/enhance/bar.ts` | `        bar.removeAttribute('role'); ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the bar is no landmark while its tray is empty; its first tool makes it a labelled navigation landmark"; "in a reader: a tool put in the tray during the build makes the bar a labelled landmark" |
| L2-T12-M63 | the first tool labels the bar | `src/enhance/bar.ts` | `        bar.setAttribute('aria-label', BAR_LABEL); ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "the bar is no landmark while its tray is empty; its first tool makes it a labelled navigation landmark"; "in a reader: a tool put in the tray during the build makes the bar a labelled landmark" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M61",
    "guard": "the bar is no landmark while its tray is empty",
    "file": "src/enhance/bar.ts",
    "old": "chrome(doc, 'nav', { className: 'topbar', attrs: { role: 'none' } },",
    "new": "chrome(doc, 'nav', { className: 'topbar' },",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M62",
    "guard": "the first tool makes the bar a navigation landmark",
    "file": "src/enhance/bar.ts",
    "old": "        bar.removeAttribute('role');\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M63",
    "guard": "the first tool labels the bar",
    "file": "src/enhance/bar.ts",
    "old": "        bar.setAttribute('aria-label', BAR_LABEL);\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  }
]
```

## The bar block of `assets/reader.css`, in a real browser (L2-T12-M64 to L2-T12-M79)

Sticky at the window's top, at the root's top edge and as wide as the root, the root's top padding and the line below
the row, the phone's padding (seen below a host's own header), the pointer through the padding and on the row, the
fixed row height that keeps `--bar-h` from feeding back, the line's colour once scrolled, the hidden bar's slide and
its distance, the sticky table head and figure tools while hidden, the progress line's width, print; and the stub,
which reddens the browser cases.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M64 | the bar sticks at the window's top | `assets/reader.css` | `> .topbar { --bar-gap: 52px; position: sticky; top: 0;` → `> .topbar { --bar-gap: 52px; position: relative; top: 0;` | `test/browser/scroll.test.ts`: 3 failed \| 6 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone"; "the bar is above the text that scrolls under it: its row takes the pointer over a section heading"; "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M65 | the bar sits at the root's top edge, as wide as the root | `assets/reader.css` | `margin: calc(-1 * var(--bar-gap)) calc(-1 * var(--pad)) 0;` → `margin: 0;` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone" |
| L2-T12-M66 | the bar takes the root's top padding and its line below its row | `assets/reader.css` | `padding: 0 0 calc(var(--bar-gap) + 1px);` → `padding: 0;` | `test/browser/scroll.test.ts`: 3 failed \| 6 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone"; "scrolled past the title: the root class, the running head with "§ n" and the section, and one spy event per section"; "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M67 | the bar takes 1 px for the line under its row | `assets/reader.css` | `padding: 0 0 calc(var(--bar-gap) + 1px);` → `padding: 0 0 var(--bar-gap);` | `test/browser/scroll.test.ts`: 2 failed \| 7 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone"; "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M68 | on a phone the bar takes the phone's top padding | `assets/reader.css` | `  [data-docreader-root][data-docreader-root]:not(i) > .topbar { --bar-gap: 28px; } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone" |
| L2-T12-M69 | the bar's padding lets the pointer through | `assets/reader.css` | `padding: 0 0 calc(var(--bar-gap) + 1px); pointer-events: none;` → `padding: 0 0 calc(var(--bar-gap) + 1px);` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone" |
| L2-T12-M70 | the bar's row takes the pointer | `assets/reader.css` | `[data-docreader-root] .topbar > * { pointer-events: auto; } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 2 failed \| 7 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone"; "the bar is above the text that scrolls under it: its row takes the pointer over a section heading" |
| L2-T12-M71 | the row's height is fixed, so --bar-h never feeds back into it | `assets/reader.css` | `gap: 16px; height: 48px; padding: 0 16px 0 20px;` → `gap: 16px; height: var(--bar-h); padding: 0 16px 0 20px;` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "--bar-h is measured: a bar made taller sets it on the root, and back" |
| L2-T12-M72 | the line under the row takes the border colour once scrolled | `assets/reader.css` | `[data-docreader-root]:not(i).scrolled .topbar-inner { box-shadow: 0 1px 0 var(--border); } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "scrolled past the title: the root class, the running head with "§ n" and the section, and one spy event per section" |
| L2-T12-M73 | on a phone the hidden bar slides away | `assets/reader.css` | `[data-docreader-root][data-docreader-root]:not(i).bar-hidden > .topbar { transform: translateY(calc(…` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M74 | the hidden bar slides by its row and its line, not by its padding | `assets/reader.css` | `transform: translateY(calc(var(--bar-gap) - 100%));` → `transform: translateY(-100%);` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M75 | while the bar is hidden, a fitted table's sticky head moves up | `assets/reader.css` | `[data-docreader-root].bar-hidden .table-wrapper.fits th { top: 0; } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M76 | while the bar is hidden, a figure's tools move up | `assets/reader.css` | `[data-docreader-root].bar-hidden figure.mermaid-figure .tools { top: 6px; } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held" |
| L2-T12-M77 | the progress line keeps the window's width | `assets/reader.css` | `[data-docreader-root][data-docreader-root]:not(i) > .doc-progress { max-width: none; margin: 0; } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "the progress line: 0 at the top, the share scrolled in the middle, the window's width at the end" |
| L2-T12-M78 | print leaves the bar out | `assets/reader.css` | `  [data-docreader-root] .topbar { display: none !important; } ⏎ ` → (deleted) | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "print leaves the bar out" |
| L2-T12-M79 | the browser cases fail without the feature (the stub) | `src/enhance/scroll.ts` | `  const { root, journal, env, slots, events, overlays, position } = ctx; ⏎ ` → `  const { root, journal, env, slots, events, overlays, position } = ctx; ⏎   if (root !== null) retu…` | `test/browser/scroll.test.ts`: 6 failed \| 3 passed \| 9 skipped (18). "two roots in one page: a root wholly scrolled past draws no line over the line of the root being read"; "the progress line: 0 at the top, the share scrolled in the middle, the window's width at the end"; "scrolled past the title: the root class, the running head with "§ n" and the section, and one spy event per section"; "at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held"; "--bar-h is measured: a bar made taller sets it on the root, and back" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M64",
    "guard": "the bar sticks at the window's top",
    "file": "assets/reader.css",
    "old": "> .topbar { --bar-gap: 52px; position: sticky; top: 0;",
    "new": "> .topbar { --bar-gap: 52px; position: relative; top: 0;",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M65",
    "guard": "the bar sits at the root's top edge, as wide as the root",
    "file": "assets/reader.css",
    "old": "margin: calc(-1 * var(--bar-gap)) calc(-1 * var(--pad)) 0;",
    "new": "margin: 0;",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M66",
    "guard": "the bar takes the root's top padding and its line below its row",
    "file": "assets/reader.css",
    "old": "padding: 0 0 calc(var(--bar-gap) + 1px);",
    "new": "padding: 0;",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M67",
    "guard": "the bar takes 1 px for the line under its row",
    "file": "assets/reader.css",
    "old": "padding: 0 0 calc(var(--bar-gap) + 1px);",
    "new": "padding: 0 0 var(--bar-gap);",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M68",
    "guard": "on a phone the bar takes the phone's top padding",
    "file": "assets/reader.css",
    "old": "  [data-docreader-root][data-docreader-root]:not(i) > .topbar { --bar-gap: 28px; }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M69",
    "guard": "the bar's padding lets the pointer through",
    "file": "assets/reader.css",
    "old": "padding: 0 0 calc(var(--bar-gap) + 1px); pointer-events: none;",
    "new": "padding: 0 0 calc(var(--bar-gap) + 1px);",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M70",
    "guard": "the bar's row takes the pointer",
    "file": "assets/reader.css",
    "old": "[data-docreader-root] .topbar > * { pointer-events: auto; }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M71",
    "guard": "the row's height is fixed, so --bar-h never feeds back into it",
    "file": "assets/reader.css",
    "old": "gap: 16px; height: 48px; padding: 0 16px 0 20px;",
    "new": "gap: 16px; height: var(--bar-h); padding: 0 16px 0 20px;",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M72",
    "guard": "the line under the row takes the border colour once scrolled",
    "file": "assets/reader.css",
    "old": "[data-docreader-root]:not(i).scrolled .topbar-inner { box-shadow: 0 1px 0 var(--border); }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M73",
    "guard": "on a phone the hidden bar slides away",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root]:not(i).bar-hidden > .topbar { transform: translateY(calc(var(--bar-gap) - 100%)); }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M74",
    "guard": "the hidden bar slides by its row and its line, not by its padding",
    "file": "assets/reader.css",
    "old": "transform: translateY(calc(var(--bar-gap) - 100%));",
    "new": "transform: translateY(-100%);",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M75",
    "guard": "while the bar is hidden, a fitted table's sticky head moves up",
    "file": "assets/reader.css",
    "old": "[data-docreader-root].bar-hidden .table-wrapper.fits th { top: 0; }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M76",
    "guard": "while the bar is hidden, a figure's tools move up",
    "file": "assets/reader.css",
    "old": "[data-docreader-root].bar-hidden figure.mermaid-figure .tools { top: 6px; }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M77",
    "guard": "the progress line keeps the window's width",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root]:not(i) > .doc-progress { max-width: none; margin: 0; }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M78",
    "guard": "print leaves the bar out",
    "file": "assets/reader.css",
    "old": "  [data-docreader-root] .topbar { display: none !important; }\n",
    "new": "",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M79",
    "guard": "the browser cases fail without the feature (the stub)",
    "file": "src/enhance/scroll.ts",
    "old": "  const { root, journal, env, slots, events, overlays, position } = ctx;\n",
    "new": "  const { root, journal, env, slots, events, overlays, position } = ctx;\n  if (root !== null) return;\n",
    "tests": "test/browser/scroll.test.ts"
  }
]
```

## Review fixes (L2-T12-M80 to L2-T12-M91)

The guards the review round added or found without a row: "In short" looked for below the root only, the bar's
`z-index` and `max-width: none`, each unit once, units with no box, folds bounded at the root, a root that had no box
at its last relayout, a relayout's reads without tasks, and the progress line of a root wholly above the window.
Measured with the rest, one row at a time.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M80 | "In short" is looked for below the root only | `src/enhance/scroll.ts` | `  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) {` → `  for (let n = el.parentElement; n !== null; n = n.parentElement) {` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a host's class "short" on the root makes no section "In short": the units and the running head are as without it" |
| L2-T12-M81 | the bar is above the text that scrolls under it | `assets/reader.css` | `position: sticky; top: 0; z-index: 100; max-width: none;` → `position: sticky; top: 0; max-width: none;` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "the bar is above the text that scrolls under it: its row takes the pointer over a section heading" |
| L2-T12-M82 | the bar is as wide as the root, not the reading column | `assets/reader.css` | `position: sticky; top: 0; z-index: 100; max-width: none;` → `position: sticky; top: 0; z-index: 100;` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18). "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone" |
| L2-T12-M83 | each unit once (an h2 task heading is its own section too) | `src/enhance/scroll.ts` | `ctx.text.inOrder([...new Set([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holder…` → `ctx.text.inOrder([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), .…` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "on a plan whose tasks are h2 headings, each is one unit: no frame reads a heading twice in one search" |
| L2-T12-M84 | a unit with no box is left out of the search | `src/enhance/scroll.ts` | `shown = units.filter((u) => !folded(u, root) && u.getClientRects().length > 0);` → `shown = units.filter((u) => !folded(u, root));` | `test/enhance-scroll.test.ts`: 2 failed \| 33 passed (35). "a unit with no box (a task's part the outline mode leaves out) is left out of the search once relayout ran"; "a root with no box when relayout ran (in a host's hidden panel) finds its units at the first frame it has one" |
| L2-T12-M85 | a fold is a hidden element up to the root, not past it | `src/enhance/scroll.ts` | `  for (let n: Element \| null = el; n !== null && n !== root; n = n.parentElement) {` → `  for (let n: Element \| null = el; n !== null; n = n.parentElement) {` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a host's hidden attribute above the root is no fold: its units are searched once the host shows it" |
| L2-T12-M86 | a root that had no box finds its units at the first frame it has one | `src/enhance/scroll.ts` | `    if (boxless && root.getClientRects().length > 0) reshow();` → `    if (false) reshow();` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a root with no box when relayout ran (in a host's hidden panel) finds its units at the first frame it has one" |
| L2-T12-M87 | while the root has no box, a frame reads no unit | `src/enhance/scroll.ts` | `    if (boxless && root.getClientRects().length > 0) reshow();` → `    if (boxless) reshow();` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a root with no box when relayout ran (in a host's hidden panel) finds its units at the first frame it has one" |
| L2-T12-M88 | the boxless state is measured at each reshow | `src/enhance/scroll.ts` | `    boxless = root.getClientRects().length === 0; ⏎ ` → (deleted) | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "a root with no box when relayout ran (in a host's hidden panel) finds its units at the first frame it has one" |
| L2-T12-M89 | without tasks a relayout reads no unit box | `src/enhance/scroll.ts` | `    if (tasks.length === 0) return; // the unit is the section` → `    if (false) return; // the unit is the section` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "without tasks a relayout's frame stays within the bound too: no unit's box is read for a search that never runs" |
| L2-T12-M90 | a root wholly above the window draws no progress line | `src/enhance/scroll.ts` | `const room = box.bottom > 0 ? box.height - vh : 0;` → `const room = box.height - vh;` | `test/enhance-scroll.test.ts` and `test/browser/scroll.test.ts`: 2 failed \| 42 passed \| 9 skipped (53). "the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits"; "two roots in one page: a root wholly scrolled past draws no line over the line of the root being read" |
| L2-T12-M91 | a root whose bottom is at the window's top is wholly above it (strict) | `src/enhance/scroll.ts` | `const room = box.bottom > 0 ? box.height - vh : 0;` → `const room = box.bottom >= 0 ? box.height - vh : 0;` | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T12-M80",
    "guard": "\"In short\" is looked for below the root only",
    "file": "src/enhance/scroll.ts",
    "old": "  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) {",
    "new": "  for (let n = el.parentElement; n !== null; n = n.parentElement) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M81",
    "guard": "the bar is above the text that scrolls under it",
    "file": "assets/reader.css",
    "old": "position: sticky; top: 0; z-index: 100; max-width: none;",
    "new": "position: sticky; top: 0; max-width: none;",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M82",
    "guard": "the bar is as wide as the root, not the reading column",
    "file": "assets/reader.css",
    "old": "position: sticky; top: 0; z-index: 100; max-width: none;",
    "new": "position: sticky; top: 0; z-index: 100;",
    "tests": "test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M83",
    "guard": "each unit once (an h2 task heading is its own section too)",
    "file": "src/enhance/scroll.ts",
    "old": "ctx.text.inOrder([...new Set([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])])",
    "new": "ctx.text.inOrder([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M84",
    "guard": "a unit with no box is left out of the search",
    "file": "src/enhance/scroll.ts",
    "old": "shown = units.filter((u) => !folded(u, root) && u.getClientRects().length > 0);",
    "new": "shown = units.filter((u) => !folded(u, root));",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M85",
    "guard": "a fold is a hidden element up to the root, not past it",
    "file": "src/enhance/scroll.ts",
    "old": "  for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) {",
    "new": "  for (let n: Element | null = el; n !== null; n = n.parentElement) {",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M86",
    "guard": "a root that had no box finds its units at the first frame it has one",
    "file": "src/enhance/scroll.ts",
    "old": "    if (boxless && root.getClientRects().length > 0) reshow();",
    "new": "    if (false) reshow();",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M87",
    "guard": "while the root has no box, a frame reads no unit",
    "file": "src/enhance/scroll.ts",
    "old": "    if (boxless && root.getClientRects().length > 0) reshow();",
    "new": "    if (boxless) reshow();",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M88",
    "guard": "the boxless state is measured at each reshow",
    "file": "src/enhance/scroll.ts",
    "old": "    boxless = root.getClientRects().length === 0;\n",
    "new": "",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M89",
    "guard": "without tasks a relayout reads no unit box",
    "file": "src/enhance/scroll.ts",
    "old": "    if (tasks.length === 0) return; // the unit is the section",
    "new": "    if (false) return; // the unit is the section",
    "tests": "test/enhance-scroll.test.ts"
  },
  {
    "id": "L2-T12-M90",
    "guard": "a root wholly above the window draws no progress line",
    "file": "src/enhance/scroll.ts",
    "old": "const room = box.bottom > 0 ? box.height - vh : 0;",
    "new": "const room = box.height - vh;",
    "tests": "test/enhance-scroll.test.ts test/browser/scroll.test.ts"
  },
  {
    "id": "L2-T12-M91",
    "guard": "a root whose bottom is at the window's top is wholly above it (strict)",
    "file": "src/enhance/scroll.ts",
    "old": "const room = box.bottom > 0 ? box.height - vh : 0;",
    "new": "const room = box.bottom >= 0 ? box.height - vh : 0;",
    "tests": "test/enhance-scroll.test.ts"
  }
]
```

## The coordinator's commit at rebase: on main with the blocks and the quick jump (L2-T12-M92)

Rebased onto `main` with Tasks 10 and 16, three things moved, and the coordinator fixed each at rebase (C54):

- **The RF3 bound.** Task 10's table measure read the root's box on every relayout, even in a document with no table.
  That added one rect read to the spy's frame, past the no-task bound of ⌈log₂(n + 1)⌉ + 2. The measure now returns
  before any read when there is no table (`src/enhance/tables.ts`, Task 10's file).
- **The dialog case** registered a stand-in `jump` overlay, which the quick jump now owns. It opens the real quick jump
  instead.
- **The `ladder` helper** placed every `h2` and `h3` in the root, the keys sheet's own headings included. It now leaves
  out the headings the reader made.

Measured 2026-10-21 on `l2-t12-scroll`, rebased onto `main`, with the change uncommitted, by `mutate.mjs` on a throwaway
copy; the checkout's status was the same before and after.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T12-M92 | a document with no table reads no rect for the tables' measure, so the spy's frame keeps its bound (Task 10's tables.ts) | `src/enhance/tables.ts` | `tables.length === 0 \|\|` removed from the measure's first check | `test/enhance-scroll.test.ts`: 1 failed \| 34 passed (35). "without tasks a relayout's frame stays within the bound too: no unit's box is read for a search that never runs" |

```json
[
  {
    "id": "L2-T12-M92",
    "guard": "a document with no table reads no rect for the tables' measure, so the spy's frame keeps its bound (Task 10's tables.ts)",
    "file": "src/enhance/tables.ts",
    "old": "  if (tables.length === 0 || ctx.root.getClientRects().length === 0) return;",
    "new": "  if (ctx.root.getClientRects().length === 0) return;",
    "tests": "--project unit test/enhance-scroll.test.ts"
  }
]
```
