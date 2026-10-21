# L2 Task 20: mutation rows (the review strip and what changed)

Each guard of Task 20, deleted or inverted once, with the tests that go red: the review strip (`src/enhance/strip.ts`,
the reference layout's section 16) and what changed (`src/enhance/changes.ts`, section 24): the host's change set
(RF4), the blocks and the places, the stepper, the keys and Hide, and `showChanges` with the day view's `after()`.
Measured again on branch `l2-t20-changes` after the review's fix round, on commit `a729da1`, every row that applies,
L2-T20-M1 to L2-T20-M152. L2-T20-M150 was measured again on `1e77eec`, after its case was sharpened (below).
149 rows apply to the code as it stands, and 147 of them are red (`rc=1`). L2-T20-M74 and L2-T20-M102 are
reported green, with the reason each is kept. L2-T20-M124, L2-T20-M127 and L2-T20-M131 are reported: their checks were
removed when a measurement found them redundant (below), so they are in the tables and not in the JSON.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), with the three changes Task 7b's rows file records: a 512 MiB
output buffer, a run that ends with no exit status reported as KILLED and counted as no verdict, and vitest's `Errors`
count line, `Unhandled Rejection` and `TypeError` lines kept in what it prints. Each row is applied to its own throwaway
copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the checkout),
its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in its file.
The rows ran one at a time, with `DOCREADER_BROWSERS=chromium` (C45); the one row whose tests are the browser file
(L2-T20-M105) was measured in WebKit too, in the Playwright image (C51). The checkout was not edited while they ran:
`git status --porcelain` (empty), the hash of `git diff` and `HEAD` read the same before the first row and after the
last. The Red column gives the count line and the failing tests the run printed (at most five here).

Notes on the measurement.
- **The review's fix round** (`a729da1`, `1e77eec`):
  - **Eight rows were added** (L2-T20-M144 to L2-T20-M151, the last section): another feature's throw caught where
    `showChanges` and Hide call it, a failed call not kept (and only its own entry dropped), and `w` bound where no strip
    is placed. All eight are red. L2-T20-M145 is red through vitest's unhandled-error check (C49): the throw escapes the
    Hide button's click listener after the case's assertions have passed.
  - **Seven rows were rewritten** to the code's new text, with the same mutation: L2-T20-M114 (Hide emits no
    sections), L2-T20-M115 and L2-T20-M116 (Hide's onHide), L2-T20-M123 (the onHide a show replaces), L2-T20-M126 (a
    show steps by default), L2-T20-M128 (one host call per base) and L2-T20-M129 (the bases kept are bounded).
  - **One check was removed** (L2-T20-M127, an onHide that is not a function). Once every onHide's throw is caught,
    the check could not be seen: on `a729da1` its row read `49 passed (49)` with no error.
  - **L2-T20-M150's case was sharpened.** On `a729da1` it went red only on vitest's 60-second timeout, because the
    host held every call for its base. The host now answers a third call at once, and the row goes red on the
    call count in 25 ms.
  - **Every case's title is as it now stands.** The case that L2-T20-M76 reddens was split in two: "a range past the
    last line marks nothing, and a step over no places does nothing", and a new case, "one range around the whole
    document marks its innermost blocks, as one place", which L2-T20-M75 reddens. L2-T20-M94 reddened the old case
    only by the throw of a step over no places, which a show now catches; it is red through "with no places, n does
    nothing but keep the key".
- The first measurement, of all 143 rows on commit `f776613`, found ten that were not red. What was done about each:
  - **Four got sharper cases**, and are red here:
    - L2-T20-M24: a task heading whose text, with its badge's step count, differs from its label;
    - L2-T20-M78: a range that joins a place through its first block only;
    - L2-T20-M91: a reading line that would fall above the window;
    - L2-T20-M97: a step that moves on from a place within a screen, where starting from the reader's position would pick another place.
  - **Two rows were restructured.** The event's sections were de-duplicated by comparing with the last section added, which also hid the "before every section" check (L2-T20-M119). They are now kept once each by a lookup, and both rows (L2-T20-M118, L2-T20-M119) are red.
  - **Two checks were removed**, because a later check covered each. The rows are reported below, not dropped (C49):
    - L2-T20-M124, the live check after a replaced show's onHide;
    - L2-T20-M131, the live check before the host is asked.
  - **Two are reported green and kept:**
    - L2-T20-M74, the walk's early stop, an RF4 efficiency bound that changes no result;
    - L2-T20-M102, the live check after goTo, which calls the host's onHash (C52).
- L2-T20-M105, the flash's restart (a new animation), is seen only in a real browser. It was measured in Chromium here, and in WebKit in the Playwright image on a copy of the tree at `1e77eec`, where it is red too: "with motion, the step lands once the smooth scroll ends; a second flash of the place starts again" fails with "expected 419 to be less than 300".
- Outside these rows, three cases in files this task may not edit are red on the branch:
  - in `test/enhance-services.test.ts`, its two key cases bind `w` themselves;
  - in `test/enhance-editorial.test.ts`, one case pins the facts panel right after the byline, where the strip now sits.

  The PR names them and their fixes. No row runs those files: every row runs `test/enhance-changes.test.ts`, or the browser file.

## The strip (`src/enhance/strip.ts`) (L2-T20-M1 to L2-T20-M48)

What waits on the reader, the decisions' counts and the plan's, the links and the `w` key, where the strip goes and when.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T20-M1 | the waiting part needs waiting items, not only their box | `src/enhance/strip.ts` | `  if (waiting.length > 0) {` → `  if (box !== null) {` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "w goes to the waiting box's heading, a new entry in the host's history; without waiting items there is no w" |
| L2-T20-M2 | w goes to the box with a new history entry | `src/enhance/strip.ts` | `run: () => ctx.nav.goTo(h3, { push: true }) });` → `run: () => ctx.nav.goTo(h3, { push: false }) });` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "w goes to the waiting box's heading, a new entry in the host's history; without waiting items there is no w"; "w is bound with waiting items where no strip is placed: on a root that is no document" |
| L2-T20-M3 | a waiting link's href names the box's heading | `src/enhance/strip.ts` | `    const href = hrefTo(ctx, h3);` → `    const href = '#';` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts" |
| L2-T20-M4 | a waiting item's text is clipped | `src/enhance/strip.ts` | `link(ctx, clip(li.textContent ?? '', WAIT_CLIP), href, li)` → `link(ctx, (li.textContent ?? '').replace(/\s+/g, ' ').trim(), href, li)` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M5 | a link leaves a click already taken alone | `src/enhance/strip.ts` | `    if (e.defaultPrevented \|\| e.button !== 0 \|\|` → `    if (e.button !== 0 \|\|` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M6 | a link leaves another button alone | `src/enhance/strip.ts` | `    if (e.defaultPrevented \|\| e.button !== 0 \|\|` → `    if (e.defaultPrevented \|\|` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M7 | a link leaves a Ctrl click alone | `src/enhance/strip.ts` | `e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` → `e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M8 | a link leaves a Cmd click alone | `src/enhance/strip.ts` | `e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` → `e.ctrlKey \|\| e.shiftKey \|\| e.altKey) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M9 | a link leaves a Shift click alone | `src/enhance/strip.ts` | `e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` → `e.ctrlKey \|\| e.metaKey \|\| e.altKey) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M10 | a link leaves an Alt click alone | `src/enhance/strip.ts` | `e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` → `e.ctrlKey \|\| e.metaKey \|\| e.shiftKey) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M11 | a link takes the click it handles | `src/enhance/strip.ts` | `    e.preventDefault(); ⏎     ctx.nav.goTo(target, { push: true });` → `    ctx.nav.goTo(target, { push: true });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone" |
| L2-T20-M12 | a link goes with a new history entry | `src/enhance/strip.ts` | `    ctx.nav.goTo(target, { push: true });` → `    ctx.nav.goTo(target, { push: false });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions"" |
| L2-T20-M13 | the decisions table is an index of definitions | `src/enhance/strip.ts` | `    if (b.kind !== 'table' \|\| !b.isIndex \|\| !b.heads` → `    if (b.kind !== 'table' \|\| !b.heads` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions"" |
| L2-T20-M14 | the decisions table has a header holding the decisions word | `src/enhance/strip.ts` | ` \|\| !b.heads.some((h) => decisionTable.test(h))) continue;` → `) continue;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions"" |
| L2-T20-M15 | the largest table wins, a tie to the first | `src/enhance/strip.ts` | `b.rows.length > dec.rows.length` → `b.rows.length >= dec.rows.length` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted" |
| L2-T20-M16 | group rows are not counted | `src/enhance/strip.ts` | `    if (r.classList.contains('group')) continue; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted" |
| L2-T20-M17 | only a chrome pill is read | `src/enhance/strip.ts` | `.querySelectorAll('.pill') ?? []).find(isChrome);` → `.querySelectorAll('.pill') ?? [])[0];` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a row the host left short of the status column counts with no word; only a chrome pill is read" |
| L2-T20-M18 | a row short of the status column has no word | `src/enhance/strip.ts` | `r.cells[si]?.querySelectorAll('.pill') ?? []` → `(r.cells[si] as HTMLTableCellElement).querySelectorAll('.pill')` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a row the host left short of the status column counts with no word; only a chrome pill is read" |
| L2-T20-M19 | a status word is counted in lower case | `src/enhance/strip.ts` | `.split(/\s/)[0] ?? '').toLowerCase();` → `.split(/\s/)[0] ?? '');` | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted"; "a row the host left short of the status column counts with no word; only a chrome pill is read" |
| L2-T20-M20 | a status is counted by its first word | `src/enhance/strip.ts` | `((pill.textContent ?? '').trim().split(/\s/)[0] ?? '')` → `((pill.textContent ?? '').trim() ?? '')` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "a row the host left short of the status column counts with no word; only a chrome pill is read" |
| L2-T20-M21 | the counts are most first | `src/enhance/strip.ts` | `[...counts].sort((x, y) => y[1].n - x[1].n)` → `[...counts]` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted" |
| L2-T20-M22 | a tie of counts keeps the order first seen, most first | `src/enhance/strip.ts` | `[...counts].sort((x, y) => y[1].n - x[1].n)` → `[...counts].sort((x, y) => x[1].n - y[1].n)` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted" |
| L2-T20-M23 | the group's name drops its section number | `src/enhance/strip.ts` | `labelOf(g).replace(SEC_NO, '')` → `labelOf(g)` | `test/enhance-changes.test.ts`: 4 failed \| 45 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted"; "a row the host left short of the status column counts with no word; only a chrome pill is read"; "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M24 | a heading's name is its aria-label first | `src/enhance/strip.ts` | `(h.getAttribute('aria-label') ?? h.textContent ?? '')` → `(h.textContent ?? '')` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M25 | a heading's name has its white space as one space | `src/enhance/strip.ts` | `(h.getAttribute('aria-label') ?? h.textContent ?? '').replace(/\s+/g, ' ').trim()` → `(h.getAttribute('aria-label') ?? h.textContent ?? '').trim()` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted" |
| L2-T20-M26 | a heading with no id is no group | `src/enhance/strip.ts` | `(p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== ''` → `(p.localName === 'h2' \|\| p.localName === 'h3')` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M27 | a level-3 heading is a group | `src/enhance/strip.ts` | `(p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== ''` → `p.localName === 'h2' && p.id !== ''` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M28 | an In short box counts by its heading | `src/enhance/strip.ts` | `if (p.classList.contains('short') \|\| p.classList.contains('callout')) return` → `if (p.classList.contains('callout')) return` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M29 | a Where things stand box counts by its heading | `src/enhance/strip.ts` | `if (p.classList.contains('short') \|\| p.classList.contains('callout')) return` → `if (p.classList.contains('short')) return` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M30 | the group is looked for through the table's ancestors too | `src/enhance/strip.ts` | `n !== null && n !== root; n = n.parentElement) {` → `n !== null && n !== root; n = null) {` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M31 | a group name not ending in s takes "rows" | `src/enhance/strip.ts` | `/s$/.test(name) ? name : `${name} rows`` → `name` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted"; "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M32 | with no group the fact goes to the first row | `src/enhance/strip.ts` | `  const target = g ?? (dec.rows[0] as HTMLTableRowElement);` → `  const target = g ?? dec.el;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions"" |
| L2-T20-M33 | the plan fact only for a long plan | `src/enhance/strip.ts` | `  if (!plan.outlineable) return null; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 4 failed \| 45 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions""; "the plan: tasks and steps on a long plan, and the reader's own steps; a separator between two facts"; "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M34 | the tasks part only with tasks | `src/enhance/strip.ts` | `  const tasks = t > 0 ? `` → `  const tasks = true ? `` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the plan: tasks and steps on a long plan, and the reader's own steps; a separator between two facts" |
| L2-T20-M35 | one task is "1 task" | `src/enhance/strip.ts` | `task${t === 1 ? '' : 's'}` → `tasks` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the plan: tasks and steps on a long plan, and the reader's own steps; a separator between two facts" |
| L2-T20-M36 | "N yours" only when steps name the reader | `src/enhance/strip.ts` | `  if (plan.yours > 0) fact.` → `  if (true) fact.` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the plan: tasks and steps on a long plan, and the reader's own steps; a separator between two facts" |
| L2-T20-M37 | a rules document needs rules: true | `src/enhance/strip.ts` | `  if (!ctx.options.rules) return false; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M38 | a rules document's key is a list | `src/enhance/strip.ts` | `some((f) => f.list && f.vals.length > 0 &&` → `some((f) => f.vals.length > 0 &&` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M39 | a rules document's key holds values | `src/enhance/strip.ts` | `some((f) => f.list && f.vals.length > 0 &&` → `some((f) => f.list &&` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M40 | a rules document's values are all rule IDs | `src/enhance/strip.ts` | `f.vals.every((v) => ctx.vocab.ruleId.test(v))` → `f.vals.some((v) => ctx.vocab.ruleId.test(v))` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M41 | a document gets the strip | `src/enhance/strip.ts` | `  if (!(ctx.info.isDocument \|\| isRulesDoc(ctx)) \|\|` → `  if (!isRulesDoc(ctx) \|\|` | `test/enhance-changes.test.ts`: 10 failed \| 39 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "a waiting item's text is clipped, and its link goes to the item through goTo; a modified click is left alone"; "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted"; "a row the host left short of the status column counts with no word; only a chrome pill is read"; "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading" |
| L2-T20-M42 | a rules document gets the strip | `src/enhance/strip.ts` | `  if (!(ctx.info.isDocument \|\| isRulesDoc(ctx)) \|\|` → `  if (!ctx.info.isDocument \|\|` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "goes after the title (past the hidden meta line) with no byline, and first in a root with no title"; "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M43 | a strip with waiting items only is placed | `src/enhance/strip.ts` | `(waiting.length === 0 && facts.length === 0)) return;` → `(facts.length === 0)) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something" |
| L2-T20-M44 | a strip with facts only is placed | `src/enhance/strip.ts` | `(waiting.length === 0 && facts.length === 0)) return;` → `(waiting.length === 0)) return;` | `test/enhance-changes.test.ts`: 6 failed \| 43 passed (49). "the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted"; "the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors', or a box by its heading"; "only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions""; "the plan: tasks and steps on a long plan, and the reader's own steps; a separator between two facts"; "goes after the title (past the hidden meta line) with no byline, and first in a root with no title" and 1 more |
| L2-T20-M45 | the strip goes after the byline | `src/enhance/strip.ts` | `  let after: Element \| null = page.byline ?? root.querySelector('h1');` → `  let after: Element \| null = root.querySelector('h1');` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts" |
| L2-T20-M46 | the strip goes past a hidden element after the title | `src/enhance/strip.ts` | `n !== null && n.hasAttribute('hidden'); n = n.nextElementSibling) after = n;` → `n !== null && false; n = n.nextElementSibling) after = n;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "goes after the title (past the hidden meta line) with no byline, and first in a root with no title" |
| L2-T20-M47 | with no title the strip goes first in the root | `src/enhance/strip.ts` | `  if (after === null) ctx.journal.insert(strip, root, root.firstChild);` → `  if (after === null) ctx.journal.insert(strip, root, null);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "goes after the title (past the hidden meta line) with no byline, and first in a root with no title" |
| L2-T20-M48 | a separator only between facts | `src/enhance/strip.ts` | `    if (i > 0) tools.appendChild(` → `    if (true) tools.appendChild(` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "sits right after the byline, before the facts panel: what waits on the reader, then the decisions' counts"; "the plan: tasks and steps on a long plan, and the reader's own steps; a separator between two facts" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T20-M1",
    "guard": "the waiting part needs waiting items, not only their box",
    "file": "src/enhance/strip.ts",
    "old": "  if (waiting.length > 0) {",
    "new": "  if (box !== null) {",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M2",
    "guard": "w goes to the box with a new history entry",
    "file": "src/enhance/strip.ts",
    "old": "run: () => ctx.nav.goTo(h3, { push: true }) });",
    "new": "run: () => ctx.nav.goTo(h3, { push: false }) });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M3",
    "guard": "a waiting link's href names the box's heading",
    "file": "src/enhance/strip.ts",
    "old": "    const href = hrefTo(ctx, h3);",
    "new": "    const href = '#';",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M4",
    "guard": "a waiting item's text is clipped",
    "file": "src/enhance/strip.ts",
    "old": "link(ctx, clip(li.textContent ?? '', WAIT_CLIP), href, li)",
    "new": "link(ctx, (li.textContent ?? '').replace(/\\s+/g, ' ').trim(), href, li)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M5",
    "guard": "a link leaves a click already taken alone",
    "file": "src/enhance/strip.ts",
    "old": "    if (e.defaultPrevented || e.button !== 0 ||",
    "new": "    if (e.button !== 0 ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M6",
    "guard": "a link leaves another button alone",
    "file": "src/enhance/strip.ts",
    "old": "    if (e.defaultPrevented || e.button !== 0 ||",
    "new": "    if (e.defaultPrevented ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M7",
    "guard": "a link leaves a Ctrl click alone",
    "file": "src/enhance/strip.ts",
    "old": "e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "e.metaKey || e.shiftKey || e.altKey) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M8",
    "guard": "a link leaves a Cmd click alone",
    "file": "src/enhance/strip.ts",
    "old": "e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "e.ctrlKey || e.shiftKey || e.altKey) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M9",
    "guard": "a link leaves a Shift click alone",
    "file": "src/enhance/strip.ts",
    "old": "e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "e.ctrlKey || e.metaKey || e.altKey) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M10",
    "guard": "a link leaves an Alt click alone",
    "file": "src/enhance/strip.ts",
    "old": "e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "e.ctrlKey || e.metaKey || e.shiftKey) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M11",
    "guard": "a link takes the click it handles",
    "file": "src/enhance/strip.ts",
    "old": "    e.preventDefault();\n    ctx.nav.goTo(target, { push: true });",
    "new": "    ctx.nav.goTo(target, { push: true });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M12",
    "guard": "a link goes with a new history entry",
    "file": "src/enhance/strip.ts",
    "old": "    ctx.nav.goTo(target, { push: true });",
    "new": "    ctx.nav.goTo(target, { push: false });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M13",
    "guard": "the decisions table is an index of definitions",
    "file": "src/enhance/strip.ts",
    "old": "    if (b.kind !== 'table' || !b.isIndex || !b.heads",
    "new": "    if (b.kind !== 'table' || !b.heads",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M14",
    "guard": "the decisions table has a header holding the decisions word",
    "file": "src/enhance/strip.ts",
    "old": " || !b.heads.some((h) => decisionTable.test(h))) continue;",
    "new": ") continue;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M15",
    "guard": "the largest table wins, a tie to the first",
    "file": "src/enhance/strip.ts",
    "old": "b.rows.length > dec.rows.length",
    "new": "b.rows.length >= dec.rows.length",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M16",
    "guard": "group rows are not counted",
    "file": "src/enhance/strip.ts",
    "old": "    if (r.classList.contains('group')) continue;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M17",
    "guard": "only a chrome pill is read",
    "file": "src/enhance/strip.ts",
    "old": ".querySelectorAll('.pill') ?? []).find(isChrome);",
    "new": ".querySelectorAll('.pill') ?? [])[0];",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M18",
    "guard": "a row short of the status column has no word",
    "file": "src/enhance/strip.ts",
    "old": "r.cells[si]?.querySelectorAll('.pill') ?? []",
    "new": "(r.cells[si] as HTMLTableCellElement).querySelectorAll('.pill')",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M19",
    "guard": "a status word is counted in lower case",
    "file": "src/enhance/strip.ts",
    "old": ".split(/\\s/)[0] ?? '').toLowerCase();",
    "new": ".split(/\\s/)[0] ?? '');",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M20",
    "guard": "a status is counted by its first word",
    "file": "src/enhance/strip.ts",
    "old": "((pill.textContent ?? '').trim().split(/\\s/)[0] ?? '')",
    "new": "((pill.textContent ?? '').trim() ?? '')",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M21",
    "guard": "the counts are most first",
    "file": "src/enhance/strip.ts",
    "old": "[...counts].sort((x, y) => y[1].n - x[1].n)",
    "new": "[...counts]",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M22",
    "guard": "a tie of counts keeps the order first seen, most first",
    "file": "src/enhance/strip.ts",
    "old": "[...counts].sort((x, y) => y[1].n - x[1].n)",
    "new": "[...counts].sort((x, y) => x[1].n - y[1].n)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M23",
    "guard": "the group's name drops its section number",
    "file": "src/enhance/strip.ts",
    "old": "labelOf(g).replace(SEC_NO, '')",
    "new": "labelOf(g)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M24",
    "guard": "a heading's name is its aria-label first",
    "file": "src/enhance/strip.ts",
    "old": "(h.getAttribute('aria-label') ?? h.textContent ?? '')",
    "new": "(h.textContent ?? '')",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M25",
    "guard": "a heading's name has its white space as one space",
    "file": "src/enhance/strip.ts",
    "old": "(h.getAttribute('aria-label') ?? h.textContent ?? '').replace(/\\s+/g, ' ').trim()",
    "new": "(h.getAttribute('aria-label') ?? h.textContent ?? '').trim()",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M26",
    "guard": "a heading with no id is no group",
    "file": "src/enhance/strip.ts",
    "old": "(p.localName === 'h2' || p.localName === 'h3') && p.id !== ''",
    "new": "(p.localName === 'h2' || p.localName === 'h3')",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M27",
    "guard": "a level-3 heading is a group",
    "file": "src/enhance/strip.ts",
    "old": "(p.localName === 'h2' || p.localName === 'h3') && p.id !== ''",
    "new": "p.localName === 'h2' && p.id !== ''",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M28",
    "guard": "an In short box counts by its heading",
    "file": "src/enhance/strip.ts",
    "old": "if (p.classList.contains('short') || p.classList.contains('callout')) return",
    "new": "if (p.classList.contains('callout')) return",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M29",
    "guard": "a Where things stand box counts by its heading",
    "file": "src/enhance/strip.ts",
    "old": "if (p.classList.contains('short') || p.classList.contains('callout')) return",
    "new": "if (p.classList.contains('short')) return",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M30",
    "guard": "the group is looked for through the table's ancestors too",
    "file": "src/enhance/strip.ts",
    "old": "n !== null && n !== root; n = n.parentElement) {",
    "new": "n !== null && n !== root; n = null) {",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M31",
    "guard": "a group name not ending in s takes \"rows\"",
    "file": "src/enhance/strip.ts",
    "old": "/s$/.test(name) ? name : `${name} rows`",
    "new": "name",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M32",
    "guard": "with no group the fact goes to the first row",
    "file": "src/enhance/strip.ts",
    "old": "  const target = g ?? (dec.rows[0] as HTMLTableRowElement);",
    "new": "  const target = g ?? dec.el;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M33",
    "guard": "the plan fact only for a long plan",
    "file": "src/enhance/strip.ts",
    "old": "  if (!plan.outlineable) return null;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M34",
    "guard": "the tasks part only with tasks",
    "file": "src/enhance/strip.ts",
    "old": "  const tasks = t > 0 ? `",
    "new": "  const tasks = true ? `",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M35",
    "guard": "one task is \"1 task\"",
    "file": "src/enhance/strip.ts",
    "old": "task${t === 1 ? '' : 's'}",
    "new": "tasks",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M36",
    "guard": "\"N yours\" only when steps name the reader",
    "file": "src/enhance/strip.ts",
    "old": "  if (plan.yours > 0) fact.",
    "new": "  if (true) fact.",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M37",
    "guard": "a rules document needs rules: true",
    "file": "src/enhance/strip.ts",
    "old": "  if (!ctx.options.rules) return false;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M38",
    "guard": "a rules document's key is a list",
    "file": "src/enhance/strip.ts",
    "old": "some((f) => f.list && f.vals.length > 0 &&",
    "new": "some((f) => f.vals.length > 0 &&",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M39",
    "guard": "a rules document's key holds values",
    "file": "src/enhance/strip.ts",
    "old": "some((f) => f.list && f.vals.length > 0 &&",
    "new": "some((f) => f.list &&",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M40",
    "guard": "a rules document's values are all rule IDs",
    "file": "src/enhance/strip.ts",
    "old": "f.vals.every((v) => ctx.vocab.ruleId.test(v))",
    "new": "f.vals.some((v) => ctx.vocab.ruleId.test(v))",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M41",
    "guard": "a document gets the strip",
    "file": "src/enhance/strip.ts",
    "old": "  if (!(ctx.info.isDocument || isRulesDoc(ctx)) ||",
    "new": "  if (!isRulesDoc(ctx) ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M42",
    "guard": "a rules document gets the strip",
    "file": "src/enhance/strip.ts",
    "old": "  if (!(ctx.info.isDocument || isRulesDoc(ctx)) ||",
    "new": "  if (!ctx.info.isDocument ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M43",
    "guard": "a strip with waiting items only is placed",
    "file": "src/enhance/strip.ts",
    "old": "(waiting.length === 0 && facts.length === 0)) return;",
    "new": "(facts.length === 0)) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M44",
    "guard": "a strip with facts only is placed",
    "file": "src/enhance/strip.ts",
    "old": "(waiting.length === 0 && facts.length === 0)) return;",
    "new": "(waiting.length === 0)) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M45",
    "guard": "the strip goes after the byline",
    "file": "src/enhance/strip.ts",
    "old": "  let after: Element | null = page.byline ?? root.querySelector('h1');",
    "new": "  let after: Element | null = root.querySelector('h1');",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M46",
    "guard": "the strip goes past a hidden element after the title",
    "file": "src/enhance/strip.ts",
    "old": "n !== null && n.hasAttribute('hidden'); n = n.nextElementSibling) after = n;",
    "new": "n !== null && false; n = n.nextElementSibling) after = n;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M47",
    "guard": "with no title the strip goes first in the root",
    "file": "src/enhance/strip.ts",
    "old": "  if (after === null) ctx.journal.insert(strip, root, root.firstChild);",
    "new": "  if (after === null) ctx.journal.insert(strip, root, null);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M48",
    "guard": "a separator only between facts",
    "file": "src/enhance/strip.ts",
    "old": "    if (i > 0) tools.appendChild(",
    "new": "    if (true) tools.appendChild(",
    "tests": "test/enhance-changes.test.ts"
  }
]
```

## The change set (`readChangeSet`, RF4) (L2-T20-M49 to L2-T20-M61)

What a host's reply must be, and what reads as no change set or as no changes.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T20-M49 | a reply that is no object is no change set | `src/enhance/changes.ts` | `    if (typeof reply !== 'object') return null; // a primitive, or a function ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M50 | a reply with no changed array is no change set | `src/enhance/changes.ts` | `    if (!Array.isArray(changed)) return null; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M51 | at most MAX_RANGES ranges | `src/enhance/changes.ts` | `    if (n > MAX_RANGES) return EMPTY;` → `    if (n > MAX_RANGES + 1) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M52 | a range is an array | `src/enhance/changes.ts` | `      if (!Array.isArray(p) \|\| p.length !== 2) return EMPTY;` → `      if (p.length !== 2) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M53 | a range is a pair | `src/enhance/changes.ts` | `      if (!Array.isArray(p) \|\| p.length !== 2) return EMPTY;` → `      if (!Array.isArray(p)) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M54 | a range's first line is an integer | `src/enhance/changes.ts` | `      if (!isInt(from) \|\| !isInt(to) \|\| from > to) return EMPTY;` → `      if (!isInt(to) \|\| from > to) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M55 | a range's last line is an integer | `src/enhance/changes.ts` | `      if (!isInt(from) \|\| !isInt(to) \|\| from > to) return EMPTY;` → `      if (!isInt(from) \|\| from > to) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M56 | a range is not inverted | `src/enhance/changes.ts` | `      if (!isInt(from) \|\| !isInt(to) \|\| from > to) return EMPTY;` → `      if (!isInt(from) \|\| !isInt(to)) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M57 | removedAfter may be left out | `src/enhance/changes.ts` | `    if (removed !== undefined) {` → `    if (true) {` | `test/enhance-changes.test.ts`: 28 failed \| 21 passed (49) |
| L2-T20-M58 | removedAfter is an array | `src/enhance/changes.ts` | `      if (!Array.isArray(removed)) return EMPTY; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M59 | at most MAX_DELETIONS deletions | `src/enhance/changes.ts` | `      if (m > MAX_DELETIONS) return EMPTY;` → `      if (m > MAX_DELETIONS + 1) return EMPTY;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M60 | a deletion is an integer | `src/enhance/changes.ts` | `        if (!isInt(k)) return EMPTY; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply with no changed array is no change set; a malformed one reads as no changes" |
| L2-T20-M61 | a getter that throws is no change set | `src/enhance/changes.ts` | `  } catch { ⏎     return null; ⏎   } ⏎ }` → `  } catch (e) { ⏎     throw e; ⏎   } ⏎ }` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a getter that throws is no change set; a getter is read once per base, never past the bounds" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T20-M49",
    "guard": "a reply that is no object is no change set",
    "file": "src/enhance/changes.ts",
    "old": "    if (typeof reply !== 'object') return null; // a primitive, or a function\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M50",
    "guard": "a reply with no changed array is no change set",
    "file": "src/enhance/changes.ts",
    "old": "    if (!Array.isArray(changed)) return null;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M51",
    "guard": "at most MAX_RANGES ranges",
    "file": "src/enhance/changes.ts",
    "old": "    if (n > MAX_RANGES) return EMPTY;",
    "new": "    if (n > MAX_RANGES + 1) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M52",
    "guard": "a range is an array",
    "file": "src/enhance/changes.ts",
    "old": "      if (!Array.isArray(p) || p.length !== 2) return EMPTY;",
    "new": "      if (p.length !== 2) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M53",
    "guard": "a range is a pair",
    "file": "src/enhance/changes.ts",
    "old": "      if (!Array.isArray(p) || p.length !== 2) return EMPTY;",
    "new": "      if (!Array.isArray(p)) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M54",
    "guard": "a range's first line is an integer",
    "file": "src/enhance/changes.ts",
    "old": "      if (!isInt(from) || !isInt(to) || from > to) return EMPTY;",
    "new": "      if (!isInt(to) || from > to) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M55",
    "guard": "a range's last line is an integer",
    "file": "src/enhance/changes.ts",
    "old": "      if (!isInt(from) || !isInt(to) || from > to) return EMPTY;",
    "new": "      if (!isInt(from) || from > to) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M56",
    "guard": "a range is not inverted",
    "file": "src/enhance/changes.ts",
    "old": "      if (!isInt(from) || !isInt(to) || from > to) return EMPTY;",
    "new": "      if (!isInt(from) || !isInt(to)) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M57",
    "guard": "removedAfter may be left out",
    "file": "src/enhance/changes.ts",
    "old": "    if (removed !== undefined) {",
    "new": "    if (true) {",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M58",
    "guard": "removedAfter is an array",
    "file": "src/enhance/changes.ts",
    "old": "      if (!Array.isArray(removed)) return EMPTY;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M59",
    "guard": "at most MAX_DELETIONS deletions",
    "file": "src/enhance/changes.ts",
    "old": "      if (m > MAX_DELETIONS) return EMPTY;",
    "new": "      if (m > MAX_DELETIONS + 1) return EMPTY;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M60",
    "guard": "a deletion is an integer",
    "file": "src/enhance/changes.ts",
    "old": "        if (!isInt(k)) return EMPTY;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M61",
    "guard": "a getter that throws is no change set",
    "file": "src/enhance/changes.ts",
    "old": "  } catch {\n    return null;\n  }\n}",
    "new": "  } catch (e) {\n    throw e;\n  }\n}",
    "tests": "test/enhance-changes.test.ts"
  }
]
```

## The blocks and the places (L2-T20-M62 to L2-T20-M83)

Which elements are blocks, and how a set's ranges and deletions become marked blocks and places.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T20-M62 | a block hidden by the layout is no block | `src/enhance/changes.ts` | `    if (m === null \|\| hiddenByLayout(el)) continue;` → `    if (m === null) continue;` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "one range around the whole document marks its innermost blocks, as one place"; "the byline carries the meta line; the hidden meta paragraph, and a block whose data-line is not a line, are no blocks" |
| L2-T20-M63 | a fold's until-found is not hidden | `src/enhance/changes.ts` | `  return h !== null && h !== 'until-found';` → `  return h !== null;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a folded section's blocks are blocks: a step reveals them" |
| L2-T20-M64 | a data-line of one line is a block | `src/enhance/changes.ts` | `const LINE = /^(\d{1,9})(?:-(\d{1,9}))?$/;` → `const LINE = /^(\d{1,9})-(\d{1,9})$/;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a block of one line ("7") is a block; a range inside a multi-line block hits it alone, whatever order the ranges come in" |
| L2-T20-M65 | a block of one line ends where it starts | `src/enhance/changes.ts` | `    bs.push(m[2] === undefined ? a : Number(m[2]));` → `    bs.push(Number(m[2]));` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a block of one line ("7") is a block; a range inside a multi-line block hits it alone, whatever order the ranges come in" |
| L2-T20-M66 | a block knows the block that holds it | `src/enhance/changes.ts` | `        parent[i] = k; ⏎         break;` → `        break;` | `test/enhance-changes.test.ts`: 5 failed \| 44 passed (49). "one range around the whole document marks its innermost blocks, as one place"; "one hunk across two table rows is one place; nested hits keep the innermost"; "ranges that share a block join the first place; ranges apart are places apart, in document order"; "a deletion marks the innermost blocks ending on the last line at or before it, a place of its own"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M67 | lines past the end are read as the line after the last | `src/enhance/changes.ts` | `  const clamp = (v: number): number => Math.min(v, last + 1);` → `  const clamp = (v: number): number => Math.min(v, last);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a range past the last line marks nothing, and a step over no places does nothing" |
| L2-T20-M68 | ranges are swept in order of their first line | `src/enhance/changes.ts` | `  const order = [...ranges.keys()].sort((p, q) => (ranges[p] as readonly [number, number])[0] - (ran…` → `  const order = [...ranges.keys()];` | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "ranges that share a block join the first place; ranges apart are places apart, in document order"; "a block of one line ("7") is a block; a range inside a multi-line block hits it alone, whatever order the ranges come in"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M69 | a block that begins before a range can hit it | `src/enhance/changes.ts` | `< x) active.push(byA[next++] as number);` → `< x) next += 1;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a block of one line ("7") is a block; a range inside a multi-line block hits it alone, whatever order the ranges come in" |
| L2-T20-M70 | a block that ended before a range does not hit it | `src/enhance/changes.ts` | `    active = active.filter((i) => (b[i] as number) >= x); ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 20 failed \| 29 passed (49) |
| L2-T20-M71 | a block that begins after a range does not hit it | `src/enhance/changes.ts` | `for (let j = next; j < n && (a[byA[j] as number] as number) <= y; j += 1)` → `for (let j = next; j < n; j += 1)` | `test/enhance-changes.test.ts`: 17 failed \| 32 passed (49). "a hostile set on a long document is bounded: whole-document ranges read as no changes past the work bound"; "one hunk across two table rows is one place; nested hits keep the innermost" |
| L2-T20-M72 | the hits are counted toward the work bound | `src/enhance/changes.ts` | `    work += hits.length; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a hostile set on a long document is bounded: whole-document ranges read as no changes past the work bound" |
| L2-T20-M73 | past the work bound the set reads as no changes | `src/enhance/changes.ts` | `    if (work > WORK_MAX) return NO_PLACES; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a hostile set on a long document is bounded: whole-document ranges read as no changes past the work bound" |
| L2-T20-M74 | a walk stops at a block an earlier walk of the range reached (RF4) | `src/enhance/changes.ts` | `        if (cover[p] === round) break; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 49 passed (49). Reported (green, kept): an RF4 efficiency bound. Without it a walk goes on to the top of the document and the places come out the same, so no case can see it. Timed in a scratch copy (a list nested 9 deep, 10,000 ranges over it): 18.5 ms with the stop, 20.0 ms without; it keeps a round of the walk to its hits and the blocks above them, once. |
| L2-T20-M75 | only the innermost hits are marked | `src/enhance/changes.ts` | `    return hits.filter((h) => cover[h] !== round).sort((x, y) => x - y);` → `    return [...hits].sort((x, y) => x - y);` | `test/enhance-changes.test.ts`: 5 failed \| 44 passed (49). "one range around the whole document marks its innermost blocks, as one place"; "one hunk across two table rows is one place; nested hits keep the innermost"; "ranges that share a block join the first place; ranges apart are places apart, in document order"; "a deletion marks the innermost blocks ending on the last line at or before it, a place of its own"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M76 | a range that hits nothing makes no place | `src/enhance/changes.ts` | `    if (ns.length === 0) continue; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a range past the last line marks nothing, and a step over no places does nothing" |
| L2-T20-M77 | a range's blocks join the first place that holds one of them | `src/enhance/changes.ts` | `      if (s >= 0 && (j < 0 \|\| s < j)) j = s;` → `      if (s >= 0) j = s;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "ranges that share a block join the first place; ranges apart are places apart, in document order" |
| L2-T20-M78 | a block in no place yet joins none | `src/enhance/changes.ts` | `      if (s >= 0 && (j < 0 \|\| s < j)) j = s;` → `      if (j < 0 \|\| s < j) j = s;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "one hunk across two table rows is one place; nested hits keep the innermost" |
| L2-T20-M79 | a deleted block a place holds makes no place of its own | `src/enhance/changes.ts` | `      if ((firstStop[i] as number) >= 0) continue; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a deletion marks the innermost blocks ending on the last line at or before it, a place of its own" |
| L2-T20-M80 | a deletion's group is the blocks ending on one line | `src/enhance/changes.ts` | `j >= 0 && b[byB[j] as number] === end; j -= 1)` → `j >= 0; j -= 1)` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a deletion marks the innermost blocks ending on the last line at or before it, a place of its own" |
| L2-T20-M81 | a deletion counts the blocks ending at k itself | `src/enhance/changes.ts` | `      if ((b[byB[mid] as number] as number) <= k) lo = mid + 1;` → `      if ((b[byB[mid] as number] as number) < k) lo = mid + 1;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a deletion marks the innermost blocks ending on the last line at or before it, a place of its own" |
| L2-T20-M82 | a place's blocks are in document order | `src/enhance/changes.ts` | `    stops: stops.map(sorted).sort(` → `    stops: stops.sort(` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M83 | the places are in document order | `src/enhance/changes.ts` | `    stops: stops.map(sorted).sort((p, q) => (p[0] as number) - (q[0] as number)),` → `    stops: stops.map(sorted),` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "ranges that share a block join the first place; ranges apart are places apart, in document order" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T20-M62",
    "guard": "a block hidden by the layout is no block",
    "file": "src/enhance/changes.ts",
    "old": "    if (m === null || hiddenByLayout(el)) continue;",
    "new": "    if (m === null) continue;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M63",
    "guard": "a fold's until-found is not hidden",
    "file": "src/enhance/changes.ts",
    "old": "  return h !== null && h !== 'until-found';",
    "new": "  return h !== null;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M64",
    "guard": "a data-line of one line is a block",
    "file": "src/enhance/changes.ts",
    "old": "const LINE = /^(\\d{1,9})(?:-(\\d{1,9}))?$/;",
    "new": "const LINE = /^(\\d{1,9})-(\\d{1,9})$/;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M65",
    "guard": "a block of one line ends where it starts",
    "file": "src/enhance/changes.ts",
    "old": "    bs.push(m[2] === undefined ? a : Number(m[2]));",
    "new": "    bs.push(Number(m[2]));",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M66",
    "guard": "a block knows the block that holds it",
    "file": "src/enhance/changes.ts",
    "old": "        parent[i] = k;\n        break;",
    "new": "        break;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M67",
    "guard": "lines past the end are read as the line after the last",
    "file": "src/enhance/changes.ts",
    "old": "  const clamp = (v: number): number => Math.min(v, last + 1);",
    "new": "  const clamp = (v: number): number => Math.min(v, last);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M68",
    "guard": "ranges are swept in order of their first line",
    "file": "src/enhance/changes.ts",
    "old": "  const order = [...ranges.keys()].sort((p, q) => (ranges[p] as readonly [number, number])[0] - (ranges[q] as readonly [number, number])[0]);",
    "new": "  const order = [...ranges.keys()];",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M69",
    "guard": "a block that begins before a range can hit it",
    "file": "src/enhance/changes.ts",
    "old": "< x) active.push(byA[next++] as number);",
    "new": "< x) next += 1;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M70",
    "guard": "a block that ended before a range does not hit it",
    "file": "src/enhance/changes.ts",
    "old": "    active = active.filter((i) => (b[i] as number) >= x);\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M71",
    "guard": "a block that begins after a range does not hit it",
    "file": "src/enhance/changes.ts",
    "old": "for (let j = next; j < n && (a[byA[j] as number] as number) <= y; j += 1)",
    "new": "for (let j = next; j < n; j += 1)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M72",
    "guard": "the hits are counted toward the work bound",
    "file": "src/enhance/changes.ts",
    "old": "    work += hits.length;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M73",
    "guard": "past the work bound the set reads as no changes",
    "file": "src/enhance/changes.ts",
    "old": "    if (work > WORK_MAX) return NO_PLACES;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M74",
    "guard": "a walk stops at a block an earlier walk of the range reached (RF4)",
    "file": "src/enhance/changes.ts",
    "old": "        if (cover[p] === round) break;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M75",
    "guard": "only the innermost hits are marked",
    "file": "src/enhance/changes.ts",
    "old": "    return hits.filter((h) => cover[h] !== round).sort((x, y) => x - y);",
    "new": "    return [...hits].sort((x, y) => x - y);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M76",
    "guard": "a range that hits nothing makes no place",
    "file": "src/enhance/changes.ts",
    "old": "    if (ns.length === 0) continue;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M77",
    "guard": "a range's blocks join the first place that holds one of them",
    "file": "src/enhance/changes.ts",
    "old": "      if (s >= 0 && (j < 0 || s < j)) j = s;",
    "new": "      if (s >= 0) j = s;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M78",
    "guard": "a block in no place yet joins none",
    "file": "src/enhance/changes.ts",
    "old": "      if (s >= 0 && (j < 0 || s < j)) j = s;",
    "new": "      if (j < 0 || s < j) j = s;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M79",
    "guard": "a deleted block a place holds makes no place of its own",
    "file": "src/enhance/changes.ts",
    "old": "      if ((firstStop[i] as number) >= 0) continue;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M80",
    "guard": "a deletion's group is the blocks ending on one line",
    "file": "src/enhance/changes.ts",
    "old": "j >= 0 && b[byB[j] as number] === end; j -= 1)",
    "new": "j >= 0; j -= 1)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M81",
    "guard": "a deletion counts the blocks ending at k itself",
    "file": "src/enhance/changes.ts",
    "old": "      if ((b[byB[mid] as number] as number) <= k) lo = mid + 1;",
    "new": "      if ((b[byB[mid] as number] as number) < k) lo = mid + 1;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M82",
    "guard": "a place's blocks are in document order",
    "file": "src/enhance/changes.ts",
    "old": "    stops: stops.map(sorted).sort(",
    "new": "    stops: stops.sort(",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M83",
    "guard": "the places are in document order",
    "file": "src/enhance/changes.ts",
    "old": "    stops: stops.map(sorted).sort((p, q) => (p[0] as number) - (q[0] as number)),",
    "new": "    stops: stops.map(sorted),",
    "tests": "test/enhance-changes.test.ts"
  }
]
```

## The stepper, the keys and Hide (L2-T20-M84 to L2-T20-M127)

The stepper in the bar, `n` and `p`, a step's start, goTo and the flash, Hide, the event's sections and a show's order of work.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T20-M84 | no comparison without changes() | `src/enhance/changes.ts` | `  if (!ctx.host.present.has('changes') \|\| ctx.info.sha === null \|\| ctx.info.draft) return;` → `  if (ctx.info.sha === null \|\| ctx.info.draft) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without changes(), a draft or a sha: no stepper, no keys, and showChanges answers unavailable" |
| L2-T20-M85 | no comparison without a sha | `src/enhance/changes.ts` | `  if (!ctx.host.present.has('changes') \|\| ctx.info.sha === null \|\| ctx.info.draft) return;` → `  if (!ctx.host.present.has('changes') \|\| ctx.info.draft) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without changes(), a draft or a sha: no stepper, no keys, and showChanges answers unavailable" |
| L2-T20-M86 | no comparison for a draft | `src/enhance/changes.ts` | `  if (!ctx.host.present.has('changes') \|\| ctx.info.sha === null \|\| ctx.info.draft) return;` → `  if (!ctx.host.present.has('changes') \|\| ctx.info.sha === null) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without changes(), a draft or a sha: no stepper, no keys, and showChanges answers unavailable" |
| L2-T20-M87 | the stepper only with the bar | `src/enhance/changes.ts` | `  if (ctx.slots !== null) {` → `  if (true) {` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without the bar: the marks and the keys, no stepper" |
| L2-T20-M88 | n and p only while a set is shown | `src/enhance/changes.ts` | `label: 'Next change', when: shown,` → `label: 'Next change',` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "the stepper sits in the bar's tray, hidden until a set is shown; then it names the comparison and counts the places"; "Hide clears every mark and the stepper, calls the onHide of what it hid, and emits no sections" |
| L2-T20-M89 | the reading line is the bar's bottom, unless the bar is hidden | `src/enhance/changes.ts` | `  if (bar === null \|\| ctx.root.classList.contains('bar-hidden')) return 0;` → `  if (bar === null) return 0;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the reading line is the bar's bottom (never above the window's top) plus 60 px, or 60 px with the bar hidden" |
| L2-T20-M90 | with no bar the reading line has no bar | `src/enhance/changes.ts` | `  if (bar === null \|\| ctx.root.classList.contains('bar-hidden')) return 0;` → `  if (ctx.root.classList.contains('bar-hidden')) return 0;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without the bar: the marks and the keys, no stepper" |
| L2-T20-M91 | the bar's bottom is never above the window's top | `src/enhance/changes.ts` | `  return Math.max(0, bar.getBoundingClientRect().bottom);` → `  return bar.getBoundingClientRect().bottom;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the reading line is the bar's bottom (never above the window's top) plus 60 px, or 60 px with the bar hidden" |
| L2-T20-M92 | the reading line is 60 px under the bar | `src/enhance/changes.ts` | `  const line = barBottom(ctx) + 60;` → `  const line = barBottom(ctx);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "from where the reader is: p before the first place below the line, and past every place n wraps to the first" |
| L2-T20-M93 | a place is below the line by more than 4 px | `src/enhance/changes.ts` | `.getBoundingClientRect().top > line + 4);` → `.getBoundingClientRect().top > line);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "from where the reader is: p before the first place below the line, and past every place n wraps to the first" |
| L2-T20-M94 | a step with nothing shown does nothing | `src/enhance/changes.ts` | `  if (s === null \|\| s.stops.length === 0) return;` → `  if (s === null) return;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "with no places, n does nothing but keep the key" |
| L2-T20-M95 | a step from where the reader is when nothing was visited | `src/enhance/changes.ts` | `  if (last === null \|\| (now - s.at` → `  if ((now - s.at` | `test/enhance-changes.test.ts`: 10 failed \| 39 passed (49). "ranges that share a block join the first place; ranges apart are places apart, in document order"; "a folded section's blocks are blocks: a step reveals them"; "a step starts from where the reader is, then moves on from the last place; p goes back; both wrap around"; "from where the reader is: p before the first place below the line, and past every place n wraps to the first"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M96 | a recent step moves on from the last place | `src/enhance/changes.ts` | `(now - s.at >= RECENT_MS && Math.abs` → `(Math.abs` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step starts from where the reader is, then moves on from the last place; p goes back; both wrap around" |
| L2-T20-M97 | a place within a screen moves on from it | `src/enhance/changes.ts` | `- line) > ctx.env.viewport().h)) {` → `- line) > 0)) {` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step starts from where the reader is, then moves on from the last place; p goes back; both wrap around" |
| L2-T20-M98 | n past every place wraps to the first | `src/enhance/changes.ts` | `    s.i = d > 0 ? (idx < 0 ? 0 : idx) :` → `    s.i = d > 0 ? (idx < 0 ? n - 1 : idx) :` | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "ranges that share a block join the first place; ranges apart are places apart, in document order"; "from where the reader is: p before the first place below the line, and past every place n wraps to the first"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M99 | a step wraps around | `src/enhance/changes.ts` | `    s.i = (s.i + d + n) % n;` → `    s.i = Math.min(Math.max(s.i + d, 0), n - 1);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step starts from where the reader is, then moves on from the last place; p goes back; both wrap around" |
| L2-T20-M100 | a step makes no history entry | `src/enhance/changes.ts` | `{ push: false, focus: false });` → `{ push: true, focus: false });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M101 | a step leaves the focus | `src/enhance/changes.ts` | `{ push: false, focus: false });` → `{ push: false, focus: true });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M102 | the live check after goTo (a host call-out, LD5, C52) | `src/enhance/changes.ts` | `  if (!ctx.live()) return; // a revealer or the host's onHash may destroy ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 49 passed (49). Reported (green, kept, C52): a live() check after a host call-out (goTo calls onHash). Once destroyed, the journal refuses the flash and env schedules nothing, so no case can see it. |
| L2-T20-M103 | a step flashes every block of its place | `src/enhance/changes.ts` | `  for (const b of place) flash(ctx, st, b);` → `  flash(ctx, st, place[0] as Element);` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "ranges that share a block join the first place; ranges apart are places apart, in document order"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M104 | a new flash of a block restarts its time | `src/enhance/changes.ts` | `  st.flashes.get(el)?.(); ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M105 | a new flash of a block restarts its animation | `src/enhance/changes.ts` | `  ctx.journal.toggleClass(el, 'flash', false); ⏎   void (el as HTMLElement).offsetWidth; // a new an…` → (deleted) | `test/browser/changes.test.ts`: 1 failed \| 1 passed \| 2 skipped (4). "with motion, the step lands once the smooth scroll ends; a second flash of the place starts again" |
| L2-T20-M106 | a flash ends | `src/enhance/changes.ts` | `      ctx.journal.toggleClass(el, 'flash', false); ⏎     }, FLASH_MS),` → `    }, FLASH_MS),` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends" |
| L2-T20-M107 | the count reads "N changes" before a step | `src/enhance/changes.ts` | `= s.i < 0 ? `${String(n)} change` → `= false ? `${String(n)} change` | `test/enhance-changes.test.ts`: 6 failed \| 43 passed (49). "a range past the last line marks nothing, and a step over no places does nothing"; "one range around the whole document marks its innermost blocks, as one place"; "ranges that share a block join the first place; ranges apart are places apart, in document order"; "the stepper sits in the bar's tray, hidden until a set is shown; then it names the comparison and counts the places"; "with no places, n does nothing but keep the key" and 1 more |
| L2-T20-M108 | one place is "1 change" | `src/enhance/changes.ts` | `change${n === 1 ? '' : 's'}` → `changes` | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "one range around the whole document marks its innermost blocks, as one place"; "the stepper sits in the bar's tray, hidden until a set is shown; then it names the comparison and counts the places"; "with info.only, the changes since it are shown at once, without a step, as "Only that day"" |
| L2-T20-M109 | no count without the stepper | `src/enhance/changes.ts` | `  if (st.stepper === null) return; ⏎   const n = s.stops.length;` → `  const n = s.stops.length;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without the bar: the marks and the keys, no stepper" |
| L2-T20-M110 | the first show clears nothing | `src/enhance/changes.ts` | `  const s = st.shown; ⏎   if (s === null) return null;` → `  const s = st.shown as Shown;` | `test/enhance-changes.test.ts`: 31 failed \| 18 passed (49) |
| L2-T20-M111 | a show clears the marks of the one before | `src/enhance/changes.ts` | `  for (const [el, cls] of s.marks) ctx.journal.toggleClass(el, cls, false); ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 5 failed \| 44 passed (49). "one hunk across two table rows is one place; nested hits keep the innermost"; "Hide clears every mark and the stepper, calls the onHide of what it hid, and emits no sections"; "a second show clears the first's marks and calls its onHide once"; "a listener's throw is caught: the show answers its places, emits to every listener and steps; Hide still calls onHide"; "a throw of the onHide a show replaces is caught: the new set is marked and its event emitted" |
| L2-T20-M112 | Hide hides the stepper | `src/enhance/changes.ts` | `  if (st.stepper !== null) st.stepper.box.hidden = true; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "Hide clears every mark and the stepper, calls the onHide of what it hid, and emits no sections" |
| L2-T20-M113 | Hide with nothing shown does nothing | `src/enhance/changes.ts` | `  if (st.shown === null) return; ⏎   const onHide = clear(ctx, st);` → `  const onHide = clear(ctx, st);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a Hide clicked with nothing shown emits nothing; an onHide that destroys stops the show that replaced it" |
| L2-T20-M114 | Hide emits no sections | `src/enhance/changes.ts` | `  attempt(() => ctx.events.emit('changes', { sections: [] })); ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 6 failed \| 43 passed (49). "Hide clears every mark and the stepper, calls the onHide of what it hid, and emits no sections"; "a Hide clicked with nothing shown emits nothing; an onHide that destroys stops the show that replaced it"; "a step button clicked with nothing shown does nothing; a listener that destroys on Hide stops its onHide"; "a shown set emits changes with the sections of its places, in order, each once; a hidden one with none (done when)"; "a listener's throw is caught: the show answers its places, emits to every listener and steps; Hide still calls onHide" and 1 more |
| L2-T20-M115 | Hide calls an onHide only when there is one | `src/enhance/changes.ts` | `  if (onHide !== null && ctx.live()) attempt(onHide);` → `  if (ctx.live()) (onHide as () => void)();` | `test/enhance-changes.test.ts`: 49 passed (49) ⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯; Errors  3 errors |
| L2-T20-M116 | Hide calls no onHide once destroyed | `src/enhance/changes.ts` | `  if (onHide !== null && ctx.live()) attempt(onHide);` → `  if (onHide !== null) attempt(onHide);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a step button clicked with nothing shown does nothing; a listener that destroys on Hide stops its onHide" |
| L2-T20-M117 | a heading's own place is its section | `src/enhance/changes.ts` | `(heads[h + 1] === first \|\| before(` → `(before(` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a shown set emits changes with the sections of its places, in order, each once; a hidden one with none (done when)" |
| L2-T20-M118 | each section once | `src/enhance/changes.ts` | `    if (sec !== undefined && !out.includes(sec)) out.push(sec);` → `    if (sec !== undefined) out.push(sec);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a shown set emits changes with the sections of its places, in order, each once; a hidden one with none (done when)" |
| L2-T20-M119 | a place before every section names none | `src/enhance/changes.ts` | `    if (sec !== undefined && !out.includes(sec)) out.push(sec);` → `    if (!out.includes(sec as HTMLElement)) out.push(sec as HTMLElement);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a shown set emits changes with the sections of its places, in order, each once; a hidden one with none (done when)" |
| L2-T20-M120 | an empty label reads "Changes" | `src/enhance/changes.ts` | `what === '' ? 'Changes' : what;` → `what;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the stepper sits in the bar's tray, hidden until a set is shown; then it names the comparison and counts the places" |
| L2-T20-M121 | the label is clipped | `src/enhance/changes.ts` | `    const what = clip(how.what, WHAT_MAX);` → `    const what = how.what;` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the stepper sits in the bar's tray, hidden until a set is shown; then it names the comparison and counts the places" |
| L2-T20-M122 | a show shows the stepper | `src/enhance/changes.ts` | `    st.stepper.box.hidden = false; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "the stepper sits in the bar's tray, hidden until a set is shown; then it names the comparison and counts the places" |
| L2-T20-M123 | a show calls the onHide of the one it replaces | `src/enhance/changes.ts` | `  if (previous !== null) attempt(previous);` → `  void previous;` | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "a Hide clicked with nothing shown emits nothing; an onHide that destroys stops the show that replaced it"; "a show stops once destroyed by the onHide it calls, or by a listener of its event: no step, no scroll"; "a second show clears the first's marks and calls its onHide once" |
| L2-T20-M124 | a show stops once its onHide destroyed | `src/enhance/changes.ts` | `  if (previous !== null) previous(); ⏎   if (!ctx.live()) return stops.length;` → `  if (previous !== null) previous();` | Reported (green, guard removed): green when first measured. Once the onHide it calls has destroyed the instance, the event emits nothing and the check right after the event stops the step, so this check was redundant. It was removed (a comment there says why); its case, "a show stops once destroyed by the onHide it calls, or by a listener of its event", still passes, and the check after the event (the next row) is kept. |
| L2-T20-M125 | a show stops once a listener of its event, or its onHide, destroyed | `src/enhance/changes.ts` | `  if (!ctx.live()) return stops.length; // a listener, or the onHide before it, may destroy ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a show stops once destroyed by the onHide it calls, or by a listener of its event: no target read, step, or scroll". The case reads no target geometry after either destroy, before nav's separate guards can hide the erroneous step. |
| L2-T20-M126 | a show steps by default | `src/enhance/changes.ts` | `  if (how.jump !== false) attempt(` → `  if (how.jump === true) attempt(` | `test/enhance-changes.test.ts`: 5 failed \| 44 passed (49). "a folded section's blocks are blocks: a step reveals them"; "a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends"; "a show stops once destroyed by the onHide it calls, or by a listener of its event: no step, no scroll"; "a listener's throw is caught: the show answers its places, emits to every listener and steps; Hide still calls onHide"; "a throw of the onHide a show replaces is caught: the new set is marked and its event emitted" |
| L2-T20-M127 | an onHide that is not a function is not kept | `src/enhance/changes.ts` | `typeof how.onHide === 'function' ? how.onHide : null` → `how.onHide ?? null` | Reported (green, guard removed): red on the first measurement only through the unhandled-error check, when Hide called a non-function and the TypeError escaped its click. Fix round 1 catches every throw of an onHide (L2-T20-M145), so on `a729da1` this row read `49 passed (49)`, no error, and the check was removed in `1e77eec` (C49). The case still shows an onHide of 5 to Hide, and it passes. |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T20-M84",
    "guard": "no comparison without changes()",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.host.present.has('changes') || ctx.info.sha === null || ctx.info.draft) return;",
    "new": "  if (ctx.info.sha === null || ctx.info.draft) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M85",
    "guard": "no comparison without a sha",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.host.present.has('changes') || ctx.info.sha === null || ctx.info.draft) return;",
    "new": "  if (!ctx.host.present.has('changes') || ctx.info.draft) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M86",
    "guard": "no comparison for a draft",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.host.present.has('changes') || ctx.info.sha === null || ctx.info.draft) return;",
    "new": "  if (!ctx.host.present.has('changes') || ctx.info.sha === null) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M87",
    "guard": "the stepper only with the bar",
    "file": "src/enhance/changes.ts",
    "old": "  if (ctx.slots !== null) {",
    "new": "  if (true) {",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M88",
    "guard": "n and p only while a set is shown",
    "file": "src/enhance/changes.ts",
    "old": "label: 'Next change', when: shown,",
    "new": "label: 'Next change',",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M89",
    "guard": "the reading line is the bar's bottom, unless the bar is hidden",
    "file": "src/enhance/changes.ts",
    "old": "  if (bar === null || ctx.root.classList.contains('bar-hidden')) return 0;",
    "new": "  if (bar === null) return 0;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M90",
    "guard": "with no bar the reading line has no bar",
    "file": "src/enhance/changes.ts",
    "old": "  if (bar === null || ctx.root.classList.contains('bar-hidden')) return 0;",
    "new": "  if (ctx.root.classList.contains('bar-hidden')) return 0;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M91",
    "guard": "the bar's bottom is never above the window's top",
    "file": "src/enhance/changes.ts",
    "old": "  return Math.max(0, bar.getBoundingClientRect().bottom);",
    "new": "  return bar.getBoundingClientRect().bottom;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M92",
    "guard": "the reading line is 60 px under the bar",
    "file": "src/enhance/changes.ts",
    "old": "  const line = barBottom(ctx) + 60;",
    "new": "  const line = barBottom(ctx);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M93",
    "guard": "a place is below the line by more than 4 px",
    "file": "src/enhance/changes.ts",
    "old": ".getBoundingClientRect().top > line + 4);",
    "new": ".getBoundingClientRect().top > line);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M94",
    "guard": "a step with nothing shown does nothing",
    "file": "src/enhance/changes.ts",
    "old": "  if (s === null || s.stops.length === 0) return;",
    "new": "  if (s === null) return;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M95",
    "guard": "a step from where the reader is when nothing was visited",
    "file": "src/enhance/changes.ts",
    "old": "  if (last === null || (now - s.at",
    "new": "  if ((now - s.at",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M96",
    "guard": "a recent step moves on from the last place",
    "file": "src/enhance/changes.ts",
    "old": "(now - s.at >= RECENT_MS && Math.abs",
    "new": "(Math.abs",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M97",
    "guard": "a place within a screen moves on from it",
    "file": "src/enhance/changes.ts",
    "old": "- line) > ctx.env.viewport().h)) {",
    "new": "- line) > 0)) {",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M98",
    "guard": "n past every place wraps to the first",
    "file": "src/enhance/changes.ts",
    "old": "    s.i = d > 0 ? (idx < 0 ? 0 : idx) :",
    "new": "    s.i = d > 0 ? (idx < 0 ? n - 1 : idx) :",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M99",
    "guard": "a step wraps around",
    "file": "src/enhance/changes.ts",
    "old": "    s.i = (s.i + d + n) % n;",
    "new": "    s.i = Math.min(Math.max(s.i + d, 0), n - 1);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M100",
    "guard": "a step makes no history entry",
    "file": "src/enhance/changes.ts",
    "old": "{ push: false, focus: false });",
    "new": "{ push: true, focus: false });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M101",
    "guard": "a step leaves the focus",
    "file": "src/enhance/changes.ts",
    "old": "{ push: false, focus: false });",
    "new": "{ push: false, focus: true });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M102",
    "guard": "the live check after goTo (a host call-out, LD5, C52)",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.live()) return; // a revealer or the host's onHash may destroy\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M103",
    "guard": "a step flashes every block of its place",
    "file": "src/enhance/changes.ts",
    "old": "  for (const b of place) flash(ctx, st, b);",
    "new": "  flash(ctx, st, place[0] as Element);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M104",
    "guard": "a new flash of a block restarts its time",
    "file": "src/enhance/changes.ts",
    "old": "  st.flashes.get(el)?.();\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M105",
    "guard": "a new flash of a block restarts its animation",
    "file": "src/enhance/changes.ts",
    "old": "  ctx.journal.toggleClass(el, 'flash', false);\n  void (el as HTMLElement).offsetWidth; // a new animation, not the one already running\n",
    "new": "",
    "tests": "test/browser/changes.test.ts"
  },
  {
    "id": "L2-T20-M106",
    "guard": "a flash ends",
    "file": "src/enhance/changes.ts",
    "old": "      ctx.journal.toggleClass(el, 'flash', false);\n    }, FLASH_MS),",
    "new": "    }, FLASH_MS),",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M107",
    "guard": "the count reads \"N changes\" before a step",
    "file": "src/enhance/changes.ts",
    "old": "= s.i < 0 ? `${String(n)} change",
    "new": "= false ? `${String(n)} change",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M108",
    "guard": "one place is \"1 change\"",
    "file": "src/enhance/changes.ts",
    "old": "change${n === 1 ? '' : 's'}",
    "new": "changes",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M109",
    "guard": "no count without the stepper",
    "file": "src/enhance/changes.ts",
    "old": "  if (st.stepper === null) return;\n  const n = s.stops.length;",
    "new": "  const n = s.stops.length;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M110",
    "guard": "the first show clears nothing",
    "file": "src/enhance/changes.ts",
    "old": "  const s = st.shown;\n  if (s === null) return null;",
    "new": "  const s = st.shown as Shown;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M111",
    "guard": "a show clears the marks of the one before",
    "file": "src/enhance/changes.ts",
    "old": "  for (const [el, cls] of s.marks) ctx.journal.toggleClass(el, cls, false);\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M112",
    "guard": "Hide hides the stepper",
    "file": "src/enhance/changes.ts",
    "old": "  if (st.stepper !== null) st.stepper.box.hidden = true;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M113",
    "guard": "Hide with nothing shown does nothing",
    "file": "src/enhance/changes.ts",
    "old": "  if (st.shown === null) return;\n  const onHide = clear(ctx, st);",
    "new": "  const onHide = clear(ctx, st);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M114",
    "guard": "Hide emits no sections",
    "file": "src/enhance/changes.ts",
    "old": "  attempt(() => ctx.events.emit('changes', { sections: [] }));\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M115",
    "guard": "Hide calls an onHide only when there is one",
    "file": "src/enhance/changes.ts",
    "old": "  if (onHide !== null && ctx.live()) attempt(onHide);",
    "new": "  if (ctx.live()) (onHide as () => void)();",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M116",
    "guard": "Hide calls no onHide once destroyed",
    "file": "src/enhance/changes.ts",
    "old": "  if (onHide !== null && ctx.live()) attempt(onHide);",
    "new": "  if (onHide !== null) attempt(onHide);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M117",
    "guard": "a heading's own place is its section",
    "file": "src/enhance/changes.ts",
    "old": "(heads[h + 1] === first || before(",
    "new": "(before(",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M118",
    "guard": "each section once",
    "file": "src/enhance/changes.ts",
    "old": "    if (sec !== undefined && !out.includes(sec)) out.push(sec);",
    "new": "    if (sec !== undefined) out.push(sec);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M119",
    "guard": "a place before every section names none",
    "file": "src/enhance/changes.ts",
    "old": "    if (sec !== undefined && !out.includes(sec)) out.push(sec);",
    "new": "    if (!out.includes(sec as HTMLElement)) out.push(sec as HTMLElement);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M120",
    "guard": "an empty label reads \"Changes\"",
    "file": "src/enhance/changes.ts",
    "old": "what === '' ? 'Changes' : what;",
    "new": "what;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M121",
    "guard": "the label is clipped",
    "file": "src/enhance/changes.ts",
    "old": "    const what = clip(how.what, WHAT_MAX);",
    "new": "    const what = how.what;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M122",
    "guard": "a show shows the stepper",
    "file": "src/enhance/changes.ts",
    "old": "    st.stepper.box.hidden = false;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M123",
    "guard": "a show calls the onHide of the one it replaces",
    "file": "src/enhance/changes.ts",
    "old": "  if (previous !== null) attempt(previous);",
    "new": "  void previous;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M125",
    "guard": "a show stops once a listener of its event, or its onHide, destroyed",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.live()) return stops.length; // a listener, or the onHide before it, may destroy\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M126",
    "guard": "a show steps by default",
    "file": "src/enhance/changes.ts",
    "old": "  if (how.jump !== false) attempt(",
    "new": "  if (how.jump === true) attempt(",
    "tests": "test/enhance-changes.test.ts"
  }
]
```

## showChanges and the day view (L2-T20-M128 to L2-T20-M143)

The export for Task 22: its refusals, the host call per base, measure, a later show winning, RF5; and `after()`.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T20-M128 | one host call per base | `src/enhance/changes.ts` | `  if (kept !== undefined) return kept; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable"; "a failed call, or a reply that is no change set, is not kept: the next show of that base asks again"; "a failed call settling late drops only its own entry: a newer call for that base, made once it was bounded out, is kept" |
| L2-T20-M129 | the bases kept are bounded | `src/enhance/changes.ts` | `  if (st.cache.size >= CACHE_MAX) st.cache.delete(st.cache.keys().next().value as string); ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable"; "a failed call settling late drops only its own entry: a newer call for that base, made once it was bounded out, is kept" |
| L2-T20-M130 | a base is read in lower case | `src/enhance/changes.ts` | `await fetchSet(ctx, st, base.toLowerCase());` → `await fetchSet(ctx, st, base);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable" |
| L2-T20-M131 | gone once not live, before the host is asked | `src/enhance/changes.ts` | `  if (!ctx.live()) return { skipped: 'gone' }; ⏎   if (st === undefined` → `  if (st === undefined` | Reported (green, guard removed): green when first measured. Once not live, the host wrapper calls nothing and answers null, and the check after the reply answers "gone" (L2-T20-M139 deletes it, red), so this first check was redundant. It was removed. |
| L2-T20-M132 | unavailable without a comparison | `src/enhance/changes.ts` | `  if (st === undefined \|\| !isSha(base) \|\|` → `  if (!isSha(base) \|\|` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "without changes(), a draft or a sha: no stepper, no keys, and showChanges answers unavailable" |
| L2-T20-M133 | a base is a sha | `src/enhance/changes.ts` | `  if (st === undefined \|\| !isSha(base) \|\|` → `  if (st === undefined \|\|` | `test/enhance-changes.test.ts`: 4 failed \| 45 passed (49). "measure counts the places and marks, shows and emits nothing"; "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable"; "a failed call, or a reply that is no change set, is not kept: the next show of that base asks again"; "not for a root that is no document, and not without only" |
| L2-T20-M134 | how is not null | `src/enhance/changes.ts` | ` \|\| how === null \|\| how === undefined \|\|` → ` \|\| how === undefined \|\|` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable" |
| L2-T20-M135 | how is not undefined | `src/enhance/changes.ts` | ` \|\| how === null \|\| how === undefined \|\|` → ` \|\| how === null \|\|` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable" |
| L2-T20-M136 | what is a string | `src/enhance/changes.ts` | ` \|\| typeof how.what !== 'string') return { skipped: 'unavailable' };` → `) return { skipped: 'unavailable' };` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable" |
| L2-T20-M137 | measure marks nothing | `src/enhance/changes.ts` | `  const measure = how.measure === true;` → `  const measure = false;` | `test/enhance-changes.test.ts`: 2 failed \| 47 passed (49). "measure counts the places and marks, shows and emits nothing"; "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable" |
| L2-T20-M138 | a measure supersedes no show | `src/enhance/changes.ts` | `  const ticket = measure ? st.asked : (st.asked += 1);` → `  const ticket = (st.asked += 1);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable" |
| L2-T20-M139 | RF5: the live check after the reply | `src/enhance/changes.ts` | `  if (!ctx.live()) return { skipped: 'gone' }; ⏎   if (set === null)` → `  if (set === null)` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "RF5: a reply after destroy writes nothing and answers gone; destroy clears the marks" |
| L2-T20-M140 | no change set is unavailable | `src/enhance/changes.ts` | `  if (set === null) return { skipped: 'unavailable' }; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 3 failed \| 46 passed (49). "a reply that is no change set is unavailable and leaves what is shown; a later show wins over an earlier reply"; "a failed call, or a reply that is no change set, is not kept: the next show of that base asks again"; "a failed call settling late drops only its own entry: a newer call for that base, made once it was bounded out, is kept" |
| L2-T20-M141 | a later show wins | `src/enhance/changes.ts` | `  if (ticket !== st.asked) return { skipped: 'superseded' }; ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a reply that is no change set is unavailable and leaves what is shown; a later show wins over an earlier reply" |
| L2-T20-M142 | the day view only for a document | `src/enhance/changes.ts` | `  if (!ctx.info.isDocument) return; ⏎   // Without info.only` → `  // Without info.only` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "not for a root that is no document, and not without only" |
| L2-T20-M143 | the day view is shown without a step | `src/enhance/changes.ts` | `{ what: ONLY_WHAT, jump: false });` → `{ what: ONLY_WHAT });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "with info.only, the changes since it are shown at once, without a step, as "Only that day"" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T20-M128",
    "guard": "one host call per base",
    "file": "src/enhance/changes.ts",
    "old": "  if (kept !== undefined) return kept;\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M129",
    "guard": "the bases kept are bounded",
    "file": "src/enhance/changes.ts",
    "old": "  if (st.cache.size >= CACHE_MAX) st.cache.delete(st.cache.keys().next().value as string);\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M130",
    "guard": "a base is read in lower case",
    "file": "src/enhance/changes.ts",
    "old": "await fetchSet(ctx, st, base.toLowerCase());",
    "new": "await fetchSet(ctx, st, base);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M132",
    "guard": "unavailable without a comparison",
    "file": "src/enhance/changes.ts",
    "old": "  if (st === undefined || !isSha(base) ||",
    "new": "  if (!isSha(base) ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M133",
    "guard": "a base is a sha",
    "file": "src/enhance/changes.ts",
    "old": "  if (st === undefined || !isSha(base) ||",
    "new": "  if (st === undefined ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M134",
    "guard": "how is not null",
    "file": "src/enhance/changes.ts",
    "old": " || how === null || how === undefined ||",
    "new": " || how === undefined ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M135",
    "guard": "how is not undefined",
    "file": "src/enhance/changes.ts",
    "old": " || how === null || how === undefined ||",
    "new": " || how === null ||",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M136",
    "guard": "what is a string",
    "file": "src/enhance/changes.ts",
    "old": " || typeof how.what !== 'string') return { skipped: 'unavailable' };",
    "new": ") return { skipped: 'unavailable' };",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M137",
    "guard": "measure marks nothing",
    "file": "src/enhance/changes.ts",
    "old": "  const measure = how.measure === true;",
    "new": "  const measure = false;",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M138",
    "guard": "a measure supersedes no show",
    "file": "src/enhance/changes.ts",
    "old": "  const ticket = measure ? st.asked : (st.asked += 1);",
    "new": "  const ticket = (st.asked += 1);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M139",
    "guard": "RF5: the live check after the reply",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.live()) return { skipped: 'gone' };\n  if (set === null)",
    "new": "  if (set === null)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M140",
    "guard": "no change set is unavailable",
    "file": "src/enhance/changes.ts",
    "old": "  if (set === null) return { skipped: 'unavailable' };\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M141",
    "guard": "a later show wins",
    "file": "src/enhance/changes.ts",
    "old": "  if (ticket !== st.asked) return { skipped: 'superseded' };\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M142",
    "guard": "the day view only for a document",
    "file": "src/enhance/changes.ts",
    "old": "  if (!ctx.info.isDocument) return;\n  // Without info.only",
    "new": "  // Without info.only",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M143",
    "guard": "the day view is shown without a step",
    "file": "src/enhance/changes.ts",
    "old": "{ what: ONLY_WHAT, jump: false });",
    "new": "{ what: ONLY_WHAT });",
    "tests": "test/enhance-changes.test.ts"
  }
]
```

## The review's fix round (L2-T20-M144 to L2-T20-M152)

Another feature's throw caught where `showChanges` and Hide call it, a failed call not kept, and `w` bound where no strip is placed.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T20-M144 | Hide emits its event after a listener's throw, and then calls the onHide | `src/enhance/changes.ts` | `  attempt(() => ctx.events.emit('changes', { sections: [] }));` → `  ctx.events.emit('changes', { sections: [] });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a listener's throw is caught: the show answers its places, emits to every listener and steps; Hide still calls onHide" |
| L2-T20-M145 | an onHide's throw on Hide is caught | `src/enhance/changes.ts` | `  if (onHide !== null && ctx.live()) attempt(onHide);` → `  if (onHide !== null && ctx.live()) onHide();` | `test/enhance-changes.test.ts`: 49 passed (49). Red through vitest's unhandled-error check (C49): the throw escapes the Hide button's click listener, and the case's assertions, all made before it, pass. |
| L2-T20-M146 | a throw of the onHide a show replaces is caught | `src/enhance/changes.ts` | `  if (previous !== null) attempt(previous);` → `  if (previous !== null) previous();` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a throw of the onHide a show replaces is caught: the new set is marked and its event emitted" |
| L2-T20-M147 | a listener's throw on a show is caught | `src/enhance/changes.ts` | `  attempt(() => ctx.events.emit('changes', { sections: sectionsOf(ctx, stops) }));` → `  ctx.events.emit('changes', { sections: sectionsOf(ctx, stops) });` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a listener's throw is caught: the show answers its places, emits to every listener and steps; Hide still calls onHide" |
| L2-T20-M148 | a throw the show's step reaches is caught | `src/enhance/changes.ts` | `  if (how.jump !== false) attempt(() => step(ctx, st, 1));` → `  if (how.jump !== false) step(ctx, st, 1);` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a throw reached by the step (a listener of reveal) is caught: the show answers its places" |
| L2-T20-M149 | a failed call, or a reply that is no change set, is not kept | `src/enhance/changes.ts` | `    if (set === null && st.cache.get(base) === p) st.cache.delete(base); ⏎ ` → (deleted) | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a failed call, or a reply that is no change set, is not kept: the next show of that base asks again" |
| L2-T20-M150 | a failed call drops only its own entry | `src/enhance/changes.ts` | `if (set === null && st.cache.get(base) === p)` → `if (set === null)` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "a failed call settling late drops only its own entry: a newer call for that base, made once it was bounded out, is kept" |
| L2-T20-M151 | w is bound where no strip is placed | `src/enhance/strip.ts` | `    ctx.keys.bind({ key: 'w',` → `    if (ctx.info.isDocument \|\| isRulesDoc(ctx)) ctx.keys.bind({ key: 'w',` | `test/enhance-changes.test.ts`: 1 failed \| 48 passed (49). "w is bound with waiting items where no strip is placed: on a root that is no document" |
| L2-T20-M152 | an in-range no-id step dispatches a smooth window scroll | `src/enhance/nav.ts` | `    jump(el, !(env.reducedMotion() \|\| far));` → `    jump(el, false);` | `test/browser/changes.test.ts`: 1 failed \| 1 passed \| 2 skipped (4). "with motion, the step lands once the smooth scroll ends; a second flash of the place starts again" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T20-M144",
    "guard": "Hide emits its event after a listener's throw, and then calls the onHide",
    "file": "src/enhance/changes.ts",
    "old": "  attempt(() => ctx.events.emit('changes', { sections: [] }));",
    "new": "  ctx.events.emit('changes', { sections: [] });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M145",
    "guard": "an onHide's throw on Hide is caught",
    "file": "src/enhance/changes.ts",
    "old": "  if (onHide !== null && ctx.live()) attempt(onHide);",
    "new": "  if (onHide !== null && ctx.live()) onHide();",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M146",
    "guard": "a throw of the onHide a show replaces is caught",
    "file": "src/enhance/changes.ts",
    "old": "  if (previous !== null) attempt(previous);",
    "new": "  if (previous !== null) previous();",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M147",
    "guard": "a listener's throw on a show is caught",
    "file": "src/enhance/changes.ts",
    "old": "  attempt(() => ctx.events.emit('changes', { sections: sectionsOf(ctx, stops) }));",
    "new": "  ctx.events.emit('changes', { sections: sectionsOf(ctx, stops) });",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M148",
    "guard": "a throw the show's step reaches is caught",
    "file": "src/enhance/changes.ts",
    "old": "  if (how.jump !== false) attempt(() => step(ctx, st, 1));",
    "new": "  if (how.jump !== false) step(ctx, st, 1);",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M149",
    "guard": "a failed call, or a reply that is no change set, is not kept",
    "file": "src/enhance/changes.ts",
    "old": "    if (set === null && st.cache.get(base) === p) st.cache.delete(base);\n",
    "new": "",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M150",
    "guard": "a failed call drops only its own entry",
    "file": "src/enhance/changes.ts",
    "old": "if (set === null && st.cache.get(base) === p)",
    "new": "if (set === null)",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M151",
    "guard": "w is bound where no strip is placed",
    "file": "src/enhance/strip.ts",
    "old": "    ctx.keys.bind({ key: 'w',",
    "new": "    if (ctx.info.isDocument || isRulesDoc(ctx)) ctx.keys.bind({ key: 'w',",
    "tests": "test/enhance-changes.test.ts"
  },
  {
    "id": "L2-T20-M152",
    "guard": "an in-range no-id step dispatches a smooth window scroll",
    "file": "src/enhance/nav.ts",
    "old": "    jump(el, !(env.reducedMotion() || far));",
    "new": "    jump(el, false);",
    "tests": "test/browser/changes.test.ts"
  }
]
```
