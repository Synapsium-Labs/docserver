# L2 Task 9: mutation rows (IDs: rule paragraphs, the rules index, lettered sections and ID rows)

Each guard of Task 9, deleted or changed once, with the tests that go red: the rules plugin (`src/enhance/rules.ts`:
what makes a paragraph a rule, its status and note, its writes through the journal and what it hides, its title and
index entries, and the rules index in the facts panel) and the IDs (`src/enhance/ids.ts`: lettered sections, and the
rows of ID tables). Measured 2026-10-20 on branch `l2-t9-ids` at `0baf415`, every row, L2-T9-M1 to L2-T9-M105:
105 were measured, all red (`rc=1`), none killed and none reported.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the three changes Task 7b's rows record: a 512 MiB output
buffer, a run that ends with no exit status reported as KILLED and counted as no verdict, and the lines it keeps
(vitest's `Errors` count line, `Unhandled Rejection` and `TypeError` lines, so a row that fails only through an
unhandled error shows why). Each row is applied to its own throwaway copy of the working tree (tracked and untracked
files, never ignored ones, `node_modules` linked from the checkout), its test file runs there with the local
`vitest`, and the copy is deleted. Each `old` occurs exactly once in its file. The rows ran with
`DOCREADER_BROWSERS=chromium` (C45): the two browser rows (L2-T9-M31 and L2-T9-M61) ran in Chromium, and WebKit was
reported as excluded. They ran in three batches, never more than two runs at once. The checkout was never edited while they ran: `git status
--porcelain` read the same (empty) before and after, and so did `HEAD` and the hash of `git diff`. The Red column
gives the count line and the failing tests the run printed (at most five here). A row that makes startup throw (a
check removed that kept a write or a definition from failing) is red through the cases whose document reaches it,
each failing with the `EnhanceError` of a failed startup.

Notes on the measurement.
- The branch was rebased onto the current tip of `l2-t7b-services` (`b78646b`) with `git rebase --onto`, replaying
  Task 9's six commits unchanged; the commits named below by their earlier hashes are, in order, `30da099`
  (was `dde98df`), `3d4174c` (was `da42b76`) and `9ea59cc` (was `1a13cbf`).
- The review round (`0baf415`) changed three places that rows name, so six rows were rewritten to the new text,
  each with the same guard: L2-T9-M28 (the hidden run now stops at a note's closing bracket), L2-T9-M92 (the chrome
  pill is filtered by `CHROME_ATTR`), and L2-T9-M94, M95, M97 and M98 (the group walk now keeps its answers). It
  added six rows, L2-T9-M100 to M105, in their own section below. Every row, old and new, was measured again on
  `0baf415`.
- A first pass, on `dde98df`, left two rows green. L2-T9-M6 (a join is a text) was green because its case put an em
  holding "and" between spaces, and a space already ends the list of IDs; the case now writes the em right between the
  two codes. L2-T9-M87 (the first cell's rest is a title only when it opens on no ID) was green because its case's rest
  was two characters, which the length check alone turns down; the rest is now longer. Both cases changed in
  `da42b76`, and every row was measured again on it.
- `1a13cbf` changes only a comment and one case's example key (the second rule key of "a key other than rules is
  named by itself" is now `refines`). The six rows whose red list names that case (L2-T9-M12, M21, M43, M44, M48 and
  M49) were measured again on it: the same count lines and the same failing tests.
- Before measuring, every check that no case could redden was removed rather than left unmeasured: the status em's
  "only after a bare dash" check (when the dash's text goes on, the node after it is that text, never an em), the
  panel's null check (a key was taken, so the panel exists), the rules index's check for an empty list key (take()
  already answers null for a key the panel does not show), `encodeURIComponent` on a rule's link (nav reads the id
  written either way), a skipped-table shortcut that only saved work, and a row's cell checks that an ID already
  implies.

## Rule paragraphs: `src/enhance/rules.ts` (L2-T9-M1 to M22)

The plugin's switch, what makes a paragraph a rule (its first code, the codes and their joins, the dash), the status em and what is taken after it.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M1 | the plugin is off by default: nothing is built without rules: true | `src/enhance/rules.ts` | `  if (!ctx.options.rules) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "off by default: without rules: true no paragraph is a rule, the panel keeps its keys and no rule is defined"; "rules: true alone recognises the default shape: two or more capitals, then dashed parts of capitals or digits" |
| L2-T9-M2 | a rule paragraph's first node is a rule code (white space or a join first is no rule) | `src/enhance/rules.ts` | `  if (!isRuleCode(first)) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M3 | a rule code holds a rule ID (the default shape) | `src/enhance/rules.ts` | `isElement(n, 'code') && vocab.ruleId.test((n.textContent ?? '').trim())` → `isElement(n, 'code')` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "rules: true alone recognises the default shape: two or more capitals, then dashed parts of capitals or digits" |
| L2-T9-M4 | a rule code is a code element (an em holding an ID is none) | `src/enhance/rules.ts` | `=> isElement(n, 'code') && vocab.ruleId` → `=> n !== null && n.nodeType === 1 && vocab.ruleId` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M5 | IDs are joined by the list's joins | `src/enhance/rules.ts` | `    else if (n.nodeType === 3 && vocab.ruleIdJoin.test(n.textContent ?? '')) joins.push(n as Text);` → `    else if (false) joins.push(n as Text);` | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a join of ", and" also joins IDs; a word that is no join ends the list, and then the paragraph is no rule"; "an ID over 200 code units is part of the head but not defined, and startup does not fail"; "destroy restores the text byte for byte: the same nodes, the same text, in the same order"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own" |
| L2-T9-M6 | a join is a text (an em holding "and" is none) | `src/enhance/rules.ts` | `    else if (n.nodeType === 3 && vocab.ruleIdJoin` → `    else if (vocab.ruleIdJoin` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M7 | the IDs are followed by something | `src/enhance/rules.ts` | `  if (n === null \|\| n.nodeType !== 3 \|\|` → `  if (n.nodeType !== 3 \|\|` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M8 | the IDs are followed by a text (an em opening on a dash is none) | `src/enhance/rules.ts` | `  if (n === null \|\| n.nodeType !== 3 \|\| !DASH` → `  if (n === null \|\| !DASH` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M9 | that text opens on a dash | `src/enhance/rules.ts` | ` \|\| !DASH.test(n.textContent ?? '')) return;` → `) return;` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "a join of ", and" also joins IDs; a word that is no join ends the list, and then the paragraph is no rule"; "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M10 | white space follows the dash | `src/enhance/rules.ts` | `const DASH = /^\s*[—–-]\s/;` → `const DASH = /^\s*[—–-]/;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M11 | an em dash, an en dash or a hyphen | `src/enhance/rules.ts` | `const DASH = /^\s*[—–-]\s/;` → `const DASH = /^\s*[—]\s/;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it" |
| L2-T9-M12 | the dash's text is split only when it goes on | `src/enhance/rules.ts` | `  if (cut < dash.data.length) journal.split(dash, cut);` → `  journal.split(dash, cut);` | `test/enhance-ids.test.ts`: 17 failed \| 26 passed (43). "one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined"; "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text" |
| L2-T9-M13 | the body's first text is split off the dash and stays shown | `src/enhance/rules.ts` | `  if (cut < dash.data.length) journal.split(dash, cut); ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a rule with no bold title takes its first sentence, without its full stop, clipped to 120"; "the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title"; "a status only from an em right after the dash, opening on a status word: text between, a strong or another word leaves no pill"; "first-wins: a rule over a row, a lettered section over a row, an earlier row over a later one; each first cell still marked" |
| L2-T9-M14 | only an em is a status (a strong is none) | `src/enhance/rules.ts` | `  if (isElement(s, 'em')) {` → `  if (s !== null && s.nodeType === 1) {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a status only from an em right after the dash, opening on a status word: text between, a strong or another word leaves no pill" |
| L2-T9-M15 | the em opens on a status word | `src/enhance/rules.ts` | `    const hit = statusOf(vocab, s.textContent ?? '');` → `    const hit = statusOf(vocab, 'done');` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text"; "a status only from an em right after the dash, opening on a status word: text between, a strong or another word leaves no pill"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own" |
| L2-T9-M16 | only a text after the em is taken (an element is left alone) | `src/enhance/rules.ts` | `      if (after !== null && after.nodeType === 3) {` → `      if (after !== null) {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a status em with nothing after it, or followed by an element or a word, takes no text after it" |
| L2-T9-M17 | a note is 40 characters or fewer | `src/enhance/rules.ts` | `const AFTER = /^\s*(\(([^)]{1,40})\))?\s*[.:]?\s*/;` → `const AFTER = /^\s*(\(([^)]{1,41})\))?\s*[.:]?\s*/;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text" |
| L2-T9-M18 | a full stop or colon after the status is taken | `src/enhance/rules.ts` | `const AFTER = /^\s*(\(([^)]{1,40})\))?\s*[.:]?\s*/;` → `const AFTER = /^\s*(\(([^)]{1,40})\))?\s*/;` | `test/enhance-ids.test.ts`: 8 failed \| 35 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text"; "a rule with no bold title takes its first sentence, without its full stop, clipped to 120"; "the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title"; "a status em of several nodes moves each into the pill, in order; the em left behind is hidden"; and 1 more |
| L2-T9-M19 | nothing is taken when nothing after the em matches | `src/enhance/rules.ts` | `        if (used > 0) {` → `        if (true) {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a status em with nothing after it, or followed by an element or a word, takes no text after it" |
| L2-T9-M20 | the text after the em is split only when it goes on | `src/enhance/rules.ts` | `          if (used < t.data.length) journal.split(t, used);` → `          journal.split(t, used);` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "the bold title is the first bold child, without a trailing colon or full stop"; "a status em with nothing after it, or followed by an element or a word, takes no text after it" |
| L2-T9-M21 | a note is split off only when there is one | `src/enhance/rules.ts` | `          if (words !== undefined) {` → `          if (true) {` | `test/enhance-ids.test.ts`: 16 failed \| 27 passed (43). "one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined"; "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text"; "a rule with no bold title takes its first sentence, without its full stop, clipped to 120" |
| L2-T9-M22 | the note's words go into its pill, without the brackets | `src/enhance/rules.ts` | `            note = journal.split(t, m[0].indexOf('(') + 1);` → `            note = journal.split(t, m[0].indexOf('('));` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text" |

```json
[
  {
    "id": "L2-T9-M1",
    "guard": "the plugin is off by default: nothing is built without rules: true",
    "file": "src/enhance/rules.ts",
    "old": "  if (!ctx.options.rules) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M2",
    "guard": "a rule paragraph's first node is a rule code (white space or a join first is no rule)",
    "file": "src/enhance/rules.ts",
    "old": "  if (!isRuleCode(first)) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M3",
    "guard": "a rule code holds a rule ID (the default shape)",
    "file": "src/enhance/rules.ts",
    "old": "isElement(n, 'code') && vocab.ruleId.test((n.textContent ?? '').trim())",
    "new": "isElement(n, 'code')",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M4",
    "guard": "a rule code is a code element (an em holding an ID is none)",
    "file": "src/enhance/rules.ts",
    "old": "=> isElement(n, 'code') && vocab.ruleId",
    "new": "=> n !== null && n.nodeType === 1 && vocab.ruleId",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M5",
    "guard": "IDs are joined by the list's joins",
    "file": "src/enhance/rules.ts",
    "old": "    else if (n.nodeType === 3 && vocab.ruleIdJoin.test(n.textContent ?? '')) joins.push(n as Text);",
    "new": "    else if (false) joins.push(n as Text);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M6",
    "guard": "a join is a text (an em holding \"and\" is none)",
    "file": "src/enhance/rules.ts",
    "old": "    else if (n.nodeType === 3 && vocab.ruleIdJoin",
    "new": "    else if (vocab.ruleIdJoin",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M7",
    "guard": "the IDs are followed by something",
    "file": "src/enhance/rules.ts",
    "old": "  if (n === null || n.nodeType !== 3 ||",
    "new": "  if (n.nodeType !== 3 ||",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M8",
    "guard": "the IDs are followed by a text (an em opening on a dash is none)",
    "file": "src/enhance/rules.ts",
    "old": "  if (n === null || n.nodeType !== 3 || !DASH",
    "new": "  if (n === null || !DASH",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M9",
    "guard": "that text opens on a dash",
    "file": "src/enhance/rules.ts",
    "old": " || !DASH.test(n.textContent ?? '')) return;",
    "new": ") return;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M10",
    "guard": "white space follows the dash",
    "file": "src/enhance/rules.ts",
    "old": "const DASH = /^\\s*[—–-]\\s/;",
    "new": "const DASH = /^\\s*[—–-]/;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M11",
    "guard": "an em dash, an en dash or a hyphen",
    "file": "src/enhance/rules.ts",
    "old": "const DASH = /^\\s*[—–-]\\s/;",
    "new": "const DASH = /^\\s*[—]\\s/;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M12",
    "guard": "the dash's text is split only when it goes on",
    "file": "src/enhance/rules.ts",
    "old": "  if (cut < dash.data.length) journal.split(dash, cut);",
    "new": "  journal.split(dash, cut);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M13",
    "guard": "the body's first text is split off the dash and stays shown",
    "file": "src/enhance/rules.ts",
    "old": "  if (cut < dash.data.length) journal.split(dash, cut);\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M14",
    "guard": "only an em is a status (a strong is none)",
    "file": "src/enhance/rules.ts",
    "old": "  if (isElement(s, 'em')) {",
    "new": "  if (s !== null && s.nodeType === 1) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M15",
    "guard": "the em opens on a status word",
    "file": "src/enhance/rules.ts",
    "old": "    const hit = statusOf(vocab, s.textContent ?? '');",
    "new": "    const hit = statusOf(vocab, 'done');",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M16",
    "guard": "only a text after the em is taken (an element is left alone)",
    "file": "src/enhance/rules.ts",
    "old": "      if (after !== null && after.nodeType === 3) {",
    "new": "      if (after !== null) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M17",
    "guard": "a note is 40 characters or fewer",
    "file": "src/enhance/rules.ts",
    "old": "const AFTER = /^\\s*(\\(([^)]{1,40})\\))?\\s*[.:]?\\s*/;",
    "new": "const AFTER = /^\\s*(\\(([^)]{1,41})\\))?\\s*[.:]?\\s*/;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M18",
    "guard": "a full stop or colon after the status is taken",
    "file": "src/enhance/rules.ts",
    "old": "const AFTER = /^\\s*(\\(([^)]{1,40})\\))?\\s*[.:]?\\s*/;",
    "new": "const AFTER = /^\\s*(\\(([^)]{1,40})\\))?\\s*/;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M19",
    "guard": "nothing is taken when nothing after the em matches",
    "file": "src/enhance/rules.ts",
    "old": "        if (used > 0) {",
    "new": "        if (true) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M20",
    "guard": "the text after the em is split only when it goes on",
    "file": "src/enhance/rules.ts",
    "old": "          if (used < t.data.length) journal.split(t, used);",
    "new": "          journal.split(t, used);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M21",
    "guard": "a note is split off only when there is one",
    "file": "src/enhance/rules.ts",
    "old": "          if (words !== undefined) {",
    "new": "          if (true) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M22",
    "guard": "the note's words go into its pill, without the brackets",
    "file": "src/enhance/rules.ts",
    "old": "            note = journal.split(t, m[0].indexOf('(') + 1);",
    "new": "            note = journal.split(t, m[0].indexOf('('));",
    "tests": "test/enhance-ids.test.ts"
  }
]
```

## Writes through the journal, and what is hidden: `src/enhance/rules.ts` (L2-T9-M23 to M31)

Each write of a rule paragraph made outside the journal (destroy then leaves it behind), and the hidden attribute of what is split off, in jsdom and in a real browser.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M23 | the head is a wrap through the journal | `src/enhance/rules.ts` | `  journal.wrap(siblingRun(first, last.nextSibling), head);` → `  { ⏎     const run = siblingRun(first, last.nextSibling); ⏎     p.insertBefore(head, first); ⏎    …` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order" |
| L2-T9-M24 | the hidden separator (a join) goes through the journal | `src/enhance/rules.ts` | `  for (const j of joins) journal.wrap([j], hiddenSpan(doc));` → `  for (const j of joins) { ⏎     const h = hiddenSpan(doc); ⏎     j.before(h); ⏎     h.append(j); ⏎…` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order" |
| L2-T9-M25 | the status pill is inserted through the journal | `src/enhance/rules.ts` | `    journal.insert(pill, head, dash); ⏎     for (const c` → `    head.insertBefore(pill, dash); ⏎     for (const c` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order" |
| L2-T9-M26 | the em's nodes move into the pill through the journal | `src/enhance/rules.ts` | `    for (const c of Array.from(marked.em.childNodes)) journal.move(c, pill, null);` → `    for (const c of Array.from(marked.em.childNodes)) pill.appendChild(c);` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order"; "a host that normalizes the root while enhanced gets the text back in order: no two parts of one text sit side by side" |
| L2-T9-M27 | the note moves into its pill through the journal | `src/enhance/rules.ts` | `      journal.move(note, info, null);` → `      info.appendChild(note);` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order"; "a host that normalizes the root while enhanced gets the text back in order: no two parts of one text sit side by side" |
| L2-T9-M28 | the hidden dash, em and brackets go through the journal | `src/enhance/rules.ts` | `  journal.wrap(siblingRun(dash, note === null ? null : last), hiddenSpan(doc));` → `  { ⏎     const h = hiddenSpan(doc); ⏎     const run = siblingRun(dash, note === null ? null : last…` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order" |
| L2-T9-M29 | the class rule goes through the journal | `src/enhance/rules.ts` | `  journal.toggleClass(p, 'rule', true);` → `  p.classList.add('rule');` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order" |
| L2-T9-M30 | what is split off is hidden | `src/enhance/rules.ts` | `chrome(doc, 'span', { attrs: { hidden: '' } });` → `chrome(doc, 'span');` | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined"; "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status only from an em right after the dash, opening on a status word: text between, a strong or another word leaves no pill"; "a status em of several nodes moves each into the pill, in order; the em left behind is hidden"; "a status em with nothing after it, or followed by an element or a word, takes no text after it" |
| L2-T9-M31 | what is split off is hidden: it takes no box in a real browser | `src/enhance/rules.ts` | `chrome(doc, 'span', { attrs: { hidden: '' } });` → `chrome(doc, 'span');` | `test/browser/ids.test.ts`: 1 failed \| 1 passed \| 2 skipped (4). "a rule head shows its codes and pills only: what it split off takes no box" |

```json
[
  {
    "id": "L2-T9-M23",
    "guard": "the head is a wrap through the journal",
    "file": "src/enhance/rules.ts",
    "old": "  journal.wrap(siblingRun(first, last.nextSibling), head);",
    "new": "  {\n    const run = siblingRun(first, last.nextSibling);\n    p.insertBefore(head, first);\n    for (const x of run) head.appendChild(x);\n  }",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M24",
    "guard": "the hidden separator (a join) goes through the journal",
    "file": "src/enhance/rules.ts",
    "old": "  for (const j of joins) journal.wrap([j], hiddenSpan(doc));",
    "new": "  for (const j of joins) {\n    const h = hiddenSpan(doc);\n    j.before(h);\n    h.append(j);\n  }",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M25",
    "guard": "the status pill is inserted through the journal",
    "file": "src/enhance/rules.ts",
    "old": "    journal.insert(pill, head, dash);\n    for (const c",
    "new": "    head.insertBefore(pill, dash);\n    for (const c",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M26",
    "guard": "the em's nodes move into the pill through the journal",
    "file": "src/enhance/rules.ts",
    "old": "    for (const c of Array.from(marked.em.childNodes)) journal.move(c, pill, null);",
    "new": "    for (const c of Array.from(marked.em.childNodes)) pill.appendChild(c);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M27",
    "guard": "the note moves into its pill through the journal",
    "file": "src/enhance/rules.ts",
    "old": "      journal.move(note, info, null);",
    "new": "      info.appendChild(note);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M28",
    "guard": "the hidden dash, em and brackets go through the journal",
    "file": "src/enhance/rules.ts",
    "old": "  journal.wrap(siblingRun(dash, note === null ? null : last), hiddenSpan(doc));",
    "new": "  {\n    const h = hiddenSpan(doc);\n    const run = siblingRun(dash, note === null ? null : last);\n    dash.before(h);\n    for (const x of run) h.appendChild(x);\n  }",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M29",
    "guard": "the class rule goes through the journal",
    "file": "src/enhance/rules.ts",
    "old": "  journal.toggleClass(p, 'rule', true);",
    "new": "  p.classList.add('rule');",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M30",
    "guard": "what is split off is hidden",
    "file": "src/enhance/rules.ts",
    "old": "chrome(doc, 'span', { attrs: { hidden: '' } });",
    "new": "chrome(doc, 'span');",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M31",
    "guard": "what is split off is hidden: it takes no box in a real browser",
    "file": "src/enhance/rules.ts",
    "old": "chrome(doc, 'span', { attrs: { hidden: '' } });",
    "new": "chrome(doc, 'span');",
    "tests": "test/browser/ids.test.ts"
  }
]
```

## Titles and definitions: `src/enhance/rules.ts` (L2-T9-M32 to M40)

A rule's title (its bold child or its first sentence), the clips, and its index entries.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M32 | a bold title drops a trailing colon or full stop | `src/enhance/rules.ts` | `    title = txt(strong).replace(/[:.]$/, '');` → `    title = txt(strong);` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined"; "the bold title is the first bold child, without a trailing colon or full stop"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own" |
| L2-T9-M33 | without a bold title, the first sentence | `src/enhance/rules.ts` | `.split(/(?<=[.!?])\s/)[0] ?? ''` → `.split(/(?!)/)[0] ?? ''` | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text"; "a rule with no bold title takes its first sentence, without its full stop, clipped to 120"; "the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own" |
| L2-T9-M34 | the first sentence drops its full stop | `src/enhance/rules.ts` | `    title = clip(sentence.replace(/\.$/, ''), TITLE_MAX);` → `    title = clip(sentence, TITLE_MAX);` | `test/enhance-ids.test.ts`: 7 failed \| 36 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text"; "a rule with no bold title takes its first sentence, without its full stop, clipped to 120"; "the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own"; and 2 more |
| L2-T9-M35 | the first sentence is clipped to 120 | `src/enhance/rules.ts` | `const TITLE_MAX = 120;` → `const TITLE_MAX = 200;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a rule with no bold title takes its first sentence, without its full stop, clipped to 120" |
| L2-T9-M36 | an entry's title is clipped to 110 | `src/enhance/rules.ts` | `const ENTRY_TITLE_MAX = 110;` → `const ENTRY_TITLE_MAX = 120;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a rule with no bold title takes its first sentence, without its full stop, clipped to 120" |
| L2-T9-M37 | an ID over 200 code units is left out | `src/enhance/rules.ts` | `    if (id.length > NAME_MAX) continue; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "an ID over 200 code units is part of the head but not defined, and startup does not fail"; "a rule ID over 200 code units is listed by its ID alone: no link, no pill, and its status is not counted" |
| L2-T9-M38 | the rules index shows the first paragraph of an ID | `src/enhance/rules.ts` | `    if (!rules.has(id)) rules.set(id, { title, status });` → `    rules.set(id, { title, status });` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own" |
| L2-T9-M39 | a rule's entry carries its status's role | `src/enhance/rules.ts` | `    const role = status === null ? null : status.role;` → `    const role = null;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill" |
| L2-T9-M40 | a rule's entry is grouped under Rules | `src/enhance/rules.ts` | `const GROUP = 'Rules';` → `const GROUP = 'Rule';` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined"; "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill" |

```json
[
  {
    "id": "L2-T9-M32",
    "guard": "a bold title drops a trailing colon or full stop",
    "file": "src/enhance/rules.ts",
    "old": "    title = txt(strong).replace(/[:.]$/, '');",
    "new": "    title = txt(strong);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M33",
    "guard": "without a bold title, the first sentence",
    "file": "src/enhance/rules.ts",
    "old": ".split(/(?<=[.!?])\\s/)[0] ?? ''",
    "new": ".split(/(?!)/)[0] ?? ''",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M34",
    "guard": "the first sentence drops its full stop",
    "file": "src/enhance/rules.ts",
    "old": "    title = clip(sentence.replace(/\\.$/, ''), TITLE_MAX);",
    "new": "    title = clip(sentence, TITLE_MAX);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M35",
    "guard": "the first sentence is clipped to 120",
    "file": "src/enhance/rules.ts",
    "old": "const TITLE_MAX = 120;",
    "new": "const TITLE_MAX = 200;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M36",
    "guard": "an entry's title is clipped to 110",
    "file": "src/enhance/rules.ts",
    "old": "const ENTRY_TITLE_MAX = 110;",
    "new": "const ENTRY_TITLE_MAX = 120;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M37",
    "guard": "an ID over 200 code units is left out",
    "file": "src/enhance/rules.ts",
    "old": "    if (id.length > NAME_MAX) continue;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M38",
    "guard": "the rules index shows the first paragraph of an ID",
    "file": "src/enhance/rules.ts",
    "old": "    if (!rules.has(id)) rules.set(id, { title, status });",
    "new": "    rules.set(id, { title, status });",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M39",
    "guard": "a rule's entry carries its status's role",
    "file": "src/enhance/rules.ts",
    "old": "    const role = status === null ? null : status.role;",
    "new": "    const role = null;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M40",
    "guard": "a rule's entry is grouped under Rules",
    "file": "src/enhance/rules.ts",
    "old": "const GROUP = 'Rules';",
    "new": "const GROUP = 'Rule';",
    "tests": "test/enhance-ids.test.ts"
  }
]
```

## The rules index: `src/enhance/rules.ts` (L2-T9-M41 to M61)

Which front-matter keys are rule keys, what the summary and the list show, and when the panel opens, in jsdom and in a real browser.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M41 | no front matter, no rules index | `src/enhance/rules.ts` | `  if (front === null) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 12 failed \| 31 passed (43). "a join of ", and" also joins IDs; a word that is no join ends the list, and then the paragraph is no rule"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text"; "the bold title is the first bold child, without a trailing colon or full stop"; "the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title"; "rules: true alone recognises the default shape: two or more capitals, then dashed parts of capitals or digits"; and 3 more |
| L2-T9-M42 | only a list key is a rule key (a scalar of the same name hides none) | `src/enhance/rules.ts` | `  const lists = front.filter((f) => f.list);` → `  const lists = front;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither" |
| L2-T9-M43 | a key that is no rule key stays the panel's | `src/enhance/rules.ts` | `    if (!isRuleKey(f)) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own"; "a key other than rules is named by itself; a list key with a value that is not a rule ID stays the panel's own"; "a rule key shadowed by an earlier key of the same name that is no rule list is left in the panel"; "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither"; "a document with no rule keys keeps the panel closed and as it was" |
| L2-T9-M44 | every value of a rule key is a rule ID | `src/enhance/rules.ts` | `f.vals.every((v) => ctx.vocab.ruleId.test(v))` → `f.vals.some((v) => ctx.vocab.ruleId.test(v))` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "a key other than rules is named by itself; a list key with a value that is not a rule ID stays the panel's own"; "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither" |
| L2-T9-M45 | a rule key hidden by an earlier key of the same name is left | `src/enhance/rules.ts` | `    if (lists.slice(0, i).some((o) => o.key === f.key && !isRuleKey(o))) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a rule key shadowed by an earlier key of the same name that is no rule list is left in the panel" |
| L2-T9-M46 | a key the panel does not show is skipped (an empty list) | `src/enhance/rules.ts` | `    if (vals === null) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither"; "without a facts panel (no title, or no front matter) rule paragraphs still build" |
| L2-T9-M47 | the key rules is the Rules index | `src/enhance/rules.ts` | `f.key === 'rules' ?` → `f.key === 'rule' ?` | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own"; "counts the statuses by their first word, in lower case, most first, a tie in the order first seen"; "a rule key shadowed by an earlier key of the same name that is no rule list is left in the panel"; "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither"; "a rule ID over 200 code units is listed by its ID alone: no link, no pill, and its status is not counted" |
| L2-T9-M48 | one rule, or rules | `src/enhance/rules.ts` | `    const noun = n === 1 ? 'rule' : 'rules';` → `    const noun = 'rules';` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "a key other than rules is named by itself; a list key with a value that is not a rule ID stays the panel's own"; "a rule key shadowed by an earlier key of the same name that is no rule list is left in the panel"; "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither" |
| L2-T9-M49 | another key is named with a capital | `src/enhance/rules.ts` | `${f.key.charAt(0).toUpperCase()}${f.key.slice(1)}` → `${f.key}` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a key other than rules is named by itself; a list key with a value that is not a rule ID stays the panel's own" |
| L2-T9-M50 | a rule without a status is not counted | `src/enhance/rules.ts` | `      if (st === null) continue; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 10 failed \| 33 passed (43). "one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined"; "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a rule with no bold title takes its first sentence, without its full stop, clipped to 120"; "destroy restores the text byte for byte: the same nodes, the same text, in the same order"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own"; and 5 more |
| L2-T9-M51 | a status is counted by its first word, before white space or a bracket | `src/enhance/rules.ts` | `st.text.split(/[\s(]/)[0]` → `st.text.split(/\s/)[0]` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "counts the statuses by their first word, in lower case, most first, a tie in the order first seen" |
| L2-T9-M52 | the counted word is in lower case | `src/enhance/rules.ts` | `      const word = (st.text.split(/[\s(]/)[0] ?? '').toLowerCase();` → `      const word = st.text.split(/[\s(]/)[0] ?? '';` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "counts the statuses by their first word, in lower case, most first, a tie in the order first seen" |
| L2-T9-M53 | the counts come most first | `src/enhance/rules.ts` | `[...counts].sort((a, b) => b[1].n - a[1].n)` → `[...counts]` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "counts the statuses by their first word, in lower case, most first, a tie in the order first seen" |
| L2-T9-M54 | a link only for an ID with a rule paragraph | `src/enhance/rules.ts` | `const lead = r === undefined ? chrome(doc, 'div', {}, inner) :` → `const lead = r === null ? chrome(doc, 'div', {}, inner) :` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own"; "a rule ID over 200 code units is listed by its ID alone: no link, no pill, and its status is not counted" |
| L2-T9-M55 | a title only when the rule has one | `src/enhance/rules.ts` | `if (r !== undefined && r.title !== '') inner.push(` → `if (r !== undefined) inner.push(` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a status em with nothing after it, or followed by an element or a word, takes no text after it" |
| L2-T9-M56 | the index shows a rule's status as a pill | `src/enhance/rules.ts` | `      const st = r?.status ?? null; ⏎       const mark` → `      const st = null; ⏎       const mark` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "a status em with nothing after it, or followed by an element or a word, takes no text after it"; "takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel's own"; "a rule ID over 200 code units is listed by its ID alone: no link, no pill, and its status is not counted" |
| L2-T9-M57 | the panel opens only when it holds a rule | `src/enhance/rules.ts` | `  if (total > 0 && (total <= OPEN_MAX` → `  if ((total <= OPEN_MAX` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither"; "a document with no rule keys keeps the panel closed and as it was"; "without a facts panel (no title, or no front matter) rule paragraphs still build" |
| L2-T9-M58 | it opens at 6 rules or fewer | `src/enhance/rules.ts` | `const OPEN_MAX = 6;` → `const OPEN_MAX = 7;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "opens at 6 rules or fewer; from 7 to 24 only at 700 px wide or more (env.matches); never at 25" |
| L2-T9-M59 | it opens up to 24 rules on a wide viewport | `src/enhance/rules.ts` | `const WIDE_MAX = 24;` → `const WIDE_MAX = 25;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "opens at 6 rules or fewer; from 7 to 24 only at 700 px wide or more (env.matches); never at 25" |
| L2-T9-M60 | from 7 rules it opens only on a wide viewport | `src/enhance/rules.ts` | `ctx.env.matches('(min-width: 700px)')` → `true` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "opens at 6 rules or fewer; from 7 to 24 only at 700 px wide or more (env.matches); never at 25" |
| L2-T9-M61 | wide is 700 px or more, measured in a real browser | `src/enhance/rules.ts` | `ctx.env.matches('(min-width: 700px)')` → `ctx.env.matches('(min-width: 701px)')` | `test/browser/ids.test.ts`: 1 failed \| 1 passed \| 2 skipped (4). "the rules index opens by the viewport: 10 rules closed at 699 px and open at 700; 6 rules open at 390" |

```json
[
  {
    "id": "L2-T9-M41",
    "guard": "no front matter, no rules index",
    "file": "src/enhance/rules.ts",
    "old": "  if (front === null) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M42",
    "guard": "only a list key is a rule key (a scalar of the same name hides none)",
    "file": "src/enhance/rules.ts",
    "old": "  const lists = front.filter((f) => f.list);",
    "new": "  const lists = front;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M43",
    "guard": "a key that is no rule key stays the panel's",
    "file": "src/enhance/rules.ts",
    "old": "    if (!isRuleKey(f)) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M44",
    "guard": "every value of a rule key is a rule ID",
    "file": "src/enhance/rules.ts",
    "old": "f.vals.every((v) => ctx.vocab.ruleId.test(v))",
    "new": "f.vals.some((v) => ctx.vocab.ruleId.test(v))",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M45",
    "guard": "a rule key hidden by an earlier key of the same name is left",
    "file": "src/enhance/rules.ts",
    "old": "    if (lists.slice(0, i).some((o) => o.key === f.key && !isRuleKey(o))) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M46",
    "guard": "a key the panel does not show is skipped (an empty list)",
    "file": "src/enhance/rules.ts",
    "old": "    if (vals === null) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M47",
    "guard": "the key rules is the Rules index",
    "file": "src/enhance/rules.ts",
    "old": "f.key === 'rules' ?",
    "new": "f.key === 'rule' ?",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M48",
    "guard": "one rule, or rules",
    "file": "src/enhance/rules.ts",
    "old": "    const noun = n === 1 ? 'rule' : 'rules';",
    "new": "    const noun = 'rules';",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M49",
    "guard": "another key is named with a capital",
    "file": "src/enhance/rules.ts",
    "old": "${f.key.charAt(0).toUpperCase()}${f.key.slice(1)}",
    "new": "${f.key}",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M50",
    "guard": "a rule without a status is not counted",
    "file": "src/enhance/rules.ts",
    "old": "      if (st === null) continue;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M51",
    "guard": "a status is counted by its first word, before white space or a bracket",
    "file": "src/enhance/rules.ts",
    "old": "st.text.split(/[\\s(]/)[0]",
    "new": "st.text.split(/\\s/)[0]",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M52",
    "guard": "the counted word is in lower case",
    "file": "src/enhance/rules.ts",
    "old": "      const word = (st.text.split(/[\\s(]/)[0] ?? '').toLowerCase();",
    "new": "      const word = st.text.split(/[\\s(]/)[0] ?? '';",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M53",
    "guard": "the counts come most first",
    "file": "src/enhance/rules.ts",
    "old": "[...counts].sort((a, b) => b[1].n - a[1].n)",
    "new": "[...counts]",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M54",
    "guard": "a link only for an ID with a rule paragraph",
    "file": "src/enhance/rules.ts",
    "old": "const lead = r === undefined ? chrome(doc, 'div', {}, inner) :",
    "new": "const lead = r === null ? chrome(doc, 'div', {}, inner) :",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M55",
    "guard": "a title only when the rule has one",
    "file": "src/enhance/rules.ts",
    "old": "if (r !== undefined && r.title !== '') inner.push(",
    "new": "if (r !== undefined) inner.push(",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M56",
    "guard": "the index shows a rule's status as a pill",
    "file": "src/enhance/rules.ts",
    "old": "      const st = r?.status ?? null;\n      const mark",
    "new": "      const st = null;\n      const mark",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M57",
    "guard": "the panel opens only when it holds a rule",
    "file": "src/enhance/rules.ts",
    "old": "  if (total > 0 && (total <= OPEN_MAX",
    "new": "  if ((total <= OPEN_MAX",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M58",
    "guard": "it opens at 6 rules or fewer",
    "file": "src/enhance/rules.ts",
    "old": "const OPEN_MAX = 6;",
    "new": "const OPEN_MAX = 7;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M59",
    "guard": "it opens up to 24 rules on a wide viewport",
    "file": "src/enhance/rules.ts",
    "old": "const WIDE_MAX = 24;",
    "new": "const WIDE_MAX = 25;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M60",
    "guard": "from 7 rules it opens only on a wide viewport",
    "file": "src/enhance/rules.ts",
    "old": "ctx.env.matches('(min-width: 700px)')",
    "new": "true",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M61",
    "guard": "wide is 700 px or more, measured in a real browser",
    "file": "src/enhance/rules.ts",
    "old": "ctx.env.matches('(min-width: 700px)')",
    "new": "ctx.env.matches('(min-width: 701px)')",
    "tests": "test/browser/ids.test.ts"
  }
]
```

## Lettered sections: `src/enhance/ids.ts` (L2-T9-M62 to M73)

Which headings define a section, their number, title and group, and that sections come before rows.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M62 | only a lettered number defines a section | `src/enhance/ids.ts` | `    if (no === null \|\| !LETTERED.test(no)) {` → `    if (no === null) {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any" |
| L2-T9-M63 | lettered: capitals, then a digit | `src/enhance/ids.ts` | `const LETTERED = /^[A-Z]+\d/;` → `const LETTERED = /^[A-Z]*\d/;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any" |
| L2-T9-M64 | the group follows the other level-2 headings | `src/enhance/ids.ts` | `      group = bare(h); ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any"; "the number is the one editorial hung (chrome): a document's own element classed sec-no is none" |
| L2-T9-M65 | the group is Sections before any other heading | `src/enhance/ids.ts` | `  let group = 'Sections';` → `  let group = '';` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any" |
| L2-T9-M66 | the number is the one editorial hung, read from its span, not the heading's text | `src/enhance/ids.ts` | `  const f = h.firstChild; ⏎   if (f === null \|\| f.nodeType !== 1) return null;` → `  const m = /^([A-Z]?\d+[a-z]?)\.\s/.exec(squash(h.textContent ?? '')); ⏎   if (m !== null) return …` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any" |
| L2-T9-M67 | the number's span is chrome (a document's own sec-no is none) | `src/enhance/ids.ts` | `  return el.classList.contains('sec-no') && el.hasAttribute(CHROME_ATTR) ? ` → `  return el.classList.contains('sec-no') ? ` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the number is the one editorial hung (chrome): a document's own element classed sec-no is none" |
| L2-T9-M68 | a heading that opens on a text has no number | `src/enhance/ids.ts` | `  if (f === null \|\| f.nodeType !== 1) return null;` → `  if (f === null) return null;` | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index"; "the group: a Where things stand box before the table counts by its heading"; "the group is found in linear time: four times the tables under one heading reads at most six times the siblings"; "RF3: on the large plan every one of its 2,000 rows is defined"; "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any" |
| L2-T9-M69 | an empty heading has no number | `src/enhance/ids.ts` | `  if (f === null \|\| f.nodeType !== 1) return null;` → `  if (f.nodeType !== 1) return null;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the number is the one editorial hung (chrome): a document's own element classed sec-no is none" |
| L2-T9-M70 | a number over 200 code units is not defined | `src/enhance/ids.ts` | `    if (no.length > NAME_MAX) continue; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a section title is clipped to 90, and a number over 200 code units is not defined" |
| L2-T9-M71 | sections are defined before rows | `src/enhance/ids.ts` | `  defineSections(ctx); ⏎   defineRows(ctx);` → `  defineRows(ctx); ⏎   defineSections(ctx);` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "first-wins: a rule over a row, a lettered section over a row, an earlier row over a later one; each first cell still marked" |
| L2-T9-M72 | a title is clipped to 90 | `src/enhance/ids.ts` | `const TITLE_MAX = 90;` → `const TITLE_MAX = 100;` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "a title is clipped to 90"; "a section title is clipped to 90, and a number over 200 code units is not defined" |
| L2-T9-M73 | a heading's text drops its number | `src/enhance/ids.ts` | `const bare = (h: Element): string => squash(h.textContent ?? '').replace(SEC_NO, '');` → `const bare = (h: Element): string => squash(h.textContent ?? '');` | `test/enhance-ids.test.ts`: 5 failed \| 38 passed (43). "outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row"; "the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index"; "first-wins: a rule over a row, a lettered section over a row, an earlier row over a later one; each first cell still marked"; "a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any"; "a section title is clipped to 90, and a number over 200 code units is not defined" |

```json
[
  {
    "id": "L2-T9-M62",
    "guard": "only a lettered number defines a section",
    "file": "src/enhance/ids.ts",
    "old": "    if (no === null || !LETTERED.test(no)) {",
    "new": "    if (no === null) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M63",
    "guard": "lettered: capitals, then a digit",
    "file": "src/enhance/ids.ts",
    "old": "const LETTERED = /^[A-Z]+\\d/;",
    "new": "const LETTERED = /^[A-Z]*\\d/;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M64",
    "guard": "the group follows the other level-2 headings",
    "file": "src/enhance/ids.ts",
    "old": "      group = bare(h);\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M65",
    "guard": "the group is Sections before any other heading",
    "file": "src/enhance/ids.ts",
    "old": "  let group = 'Sections';",
    "new": "  let group = '';",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M66",
    "guard": "the number is the one editorial hung, read from its span, not the heading's text",
    "file": "src/enhance/ids.ts",
    "old": "  const f = h.firstChild;\n  if (f === null || f.nodeType !== 1) return null;",
    "new": "  const m = /^([A-Z]?\\d+[a-z]?)\\.\\s/.exec(squash(h.textContent ?? ''));\n  if (m !== null) return m[1] ?? null;\n  const f = h.firstChild;\n  if (f === null || f.nodeType !== 1) return null;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M67",
    "guard": "the number's span is chrome (a document's own sec-no is none)",
    "file": "src/enhance/ids.ts",
    "old": "  return el.classList.contains('sec-no') && el.hasAttribute(CHROME_ATTR) ? ",
    "new": "  return el.classList.contains('sec-no') ? ",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M68",
    "guard": "a heading that opens on a text has no number",
    "file": "src/enhance/ids.ts",
    "old": "  if (f === null || f.nodeType !== 1) return null;",
    "new": "  if (f === null) return null;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M69",
    "guard": "an empty heading has no number",
    "file": "src/enhance/ids.ts",
    "old": "  if (f === null || f.nodeType !== 1) return null;",
    "new": "  if (f.nodeType !== 1) return null;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M70",
    "guard": "a number over 200 code units is not defined",
    "file": "src/enhance/ids.ts",
    "old": "    if (no.length > NAME_MAX) continue;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M71",
    "guard": "sections are defined before rows",
    "file": "src/enhance/ids.ts",
    "old": "  defineSections(ctx);\n  defineRows(ctx);",
    "new": "  defineRows(ctx);\n  defineSections(ctx);",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M72",
    "guard": "a title is clipped to 90",
    "file": "src/enhance/ids.ts",
    "old": "const TITLE_MAX = 90;",
    "new": "const TITLE_MAX = 100;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M73",
    "guard": "a heading's text drops its number",
    "file": "src/enhance/ids.ts",
    "old": "const bare = (h: Element): string => squash(h.textContent ?? '').replace(SEC_NO, '');",
    "new": "const bare = (h: Element): string => squash(h.textContent ?? '');",
    "tests": "test/enhance-ids.test.ts"
  }
]
```

## ID rows: `src/enhance/ids.ts` (L2-T9-M74 to M99)

What makes a table an index, which rows define an ID, their title, status and group, and idcell through the journal.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M74 | only tables have rows (a code block is skipped) | `src/enhance/ids.ts` | `    if (block.kind !== 'table') continue; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads"; "outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row"; "destroy removes idcell" |
| L2-T9-M75 | a first cell is read without hidden chrome | `src/enhance/ids.ts` | `    if (x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute…` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a first cell is read without hidden chrome, as the reference read it once a bullet was gone; the document's own hidden text counts" |
| L2-T9-M76 | only hidden chrome is left out (the document's own hidden text counts) | `src/enhance/ids.ts` | `x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute('hidden…` → `x.nodeType === 1 && (x as Element).hasAttribute('hidden')` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a first cell is read without hidden chrome, as the reference read it once a bullet was gone; the document's own hidden text counts" |
| L2-T9-M77 | outside an index, an exact ID is 10 characters or fewer | `src/enhance/ids.ts` | `const EXACT_MAX = 10;` → `const EXACT_MAX = 11;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row" |
| L2-T9-M78 | outside an index, the whole first cell is the ID | `src/enhance/ids.ts` | `idAt(t) === t ? t : null` → `idAt(t) !== null ? idAt(t) : null` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the threshold: two rows or more, with at least 60% of the first cells opening on an ID" |
| L2-T9-M79 | an index has two rows or more | `src/enhance/ids.ts` | `rows.length >= INDEX_ROWS && ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the threshold: two rows or more, with at least 60% of the first cells opening on an ID" |
| L2-T9-M80 | an index has 60% of its first cells opening on an ID | `src/enhance/ids.ts` | `const INDEX_SHARE = 0.6;` → `const INDEX_SHARE = 0.4;` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads"; "outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row"; "the threshold: two rows or more, with at least 60% of the first cells opening on an ID" |
| L2-T9-M81 | blocks[].isIndex is written | `src/enhance/ids.ts` | `    block.isIndex = isIndex; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the threshold: two rows or more, with at least 60% of the first cells opening on an ID" |
| L2-T9-M82 | an index defines each opening ID, another table only exact ones | `src/enhance/ids.ts` | `(isIndex ? opening[i] : exact[i])` → `opening[i]` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads"; "outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row"; "the threshold: two rows or more, with at least 60% of the first cells opening on an ID" |
| L2-T9-M83 | idcell goes through the journal | `src/enhance/ids.ts` | `      journal.toggleClass(r.cells[0] as HTMLTableCellElement, 'idcell', true);` → `      (r.cells[0] as HTMLTableCellElement).classList.add('idcell');` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "destroy restores the text byte for byte: the same nodes, the same text, in the same order"; "destroy removes idcell" |
| L2-T9-M84 | a row ID over 200 code units is not defined | `src/enhance/ids.ts` | `      if (id.length > NAME_MAX) return; ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "an ID over 200 code units marks its cell but is not defined, and startup does not fail" |
| L2-T9-M85 | the rest of the first cell drops a separator | `src/enhance/ids.ts` | `.replace(/^[\s,:.-]+/, '')` → `.replace(/^\s+/, '')` | `test/enhance-ids.test.ts`: 3 failed \| 40 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads"; "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell"; "a first cell is read without hidden chrome, as the reference read it once a bullet was gone; the document's own hidden text counts" |
| L2-T9-M86 | the rest is a title when longer than two characters | `src/enhance/ids.ts` | `rest.length > 2 &&` → `rest.length > 0 &&` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "the threshold: two rows or more, with at least 60% of the first cells opening on an ID"; "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell" |
| L2-T9-M87 | the rest is a title when it opens on no ID | `src/enhance/ids.ts` | `rest.length > 2 && !vocab.id.test(rest) ?` → `rest.length > 2 ?` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell" |
| L2-T9-M88 | the title column, else the second cell | `src/enhance/ids.ts` | `      const tc = r.cells[titleCol] ?? r.cells[1];` → `      const tc = r.cells[1];` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell" |
| L2-T9-M89 | the title column comes after the first | `src/enhance/ids.ts` | `findIndex((h, i) => i > 0 && vocab.titleHeader.test(h))` → `findIndex((h) => vocab.titleHeader.test(h))` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell" |
| L2-T9-M90 | a row with no title cell has an empty title | `src/enhance/ids.ts` | `tc === undefined ? '' : shown(tc)` → `shown(tc as Node)` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell" |
| L2-T9-M91 | the status is the row's last pill | `src/enhance/ids.ts` | `  const last = pills[pills.length - 1];` → `  const last = pills[0];` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the status is the role of the row's last chrome pill; an element of the document classed pill is not one" |
| L2-T9-M92 | the status is a chrome pill's (a document's own .pill is none) | `src/enhance/ids.ts` | `Array.from(row.querySelectorAll('.pill')).filter((e) => e.hasAttribute(CHROME_ATTR))` → `Array.from(row.querySelectorAll('.pill'))` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the status is the role of the row's last chrome pill; an element of the document classed pill is not one" |
| L2-T9-M93 | a row with no pill has no status | `src/enhance/ids.ts` | `  return last === undefined ? null : (ROLES` → `  return (ROLES` | `test/enhance-ids.test.ts`: 13 failed \| 30 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads"; "outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row"; "the threshold: two rows or more, with at least 60% of the first cells opening on an ID"; "the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell"; "a title is clipped to 90"; and 2 more |
| L2-T9-M94 | the group is an h2 or h3 (an h4 is none) | `src/enhance/ids.ts` | `      if ((p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== '') {` → `      if (/^h[2-6]$/.test(p.localName) && p.id !== '') {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index" |
| L2-T9-M95 | the group heading has an id | `src/enhance/ids.ts` | ` && p.id !== '') {` → `) {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index" |
| L2-T9-M96 | a box of In short or Where things stand counts by its heading | `src/enhance/ids.ts` | `      if (p.classList.contains('short') \|\| p.classList.contains('callout')) {` → `      if (false) {` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index"; "the group: a Where things stand box before the table counts by its heading" |
| L2-T9-M97 | the group is looked for up through the table's ancestors | `src/enhance/ids.ts` | `        n = n.parentElement; ⏎         continue;` → `        break;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index" |
| L2-T9-M98 | the group is looked for inside the root only | `src/enhance/ids.ts` | `table; n !== null && n !== root; ) {` → `table; n !== null; ) {` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads" |
| L2-T9-M99 | a table under no heading is grouped as Index | `src/enhance/ids.ts` | `const group = g === null ? 'Index' : bare(g);` → `const group = g === null ? '' : bare(g);` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads" |

```json
[
  {
    "id": "L2-T9-M74",
    "guard": "only tables have rows (a code block is skipped)",
    "file": "src/enhance/ids.ts",
    "old": "    if (block.kind !== 'table') continue;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M75",
    "guard": "a first cell is read without hidden chrome",
    "file": "src/enhance/ids.ts",
    "old": "    if (x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute('hidden')) continue;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M76",
    "guard": "only hidden chrome is left out (the document's own hidden text counts)",
    "file": "src/enhance/ids.ts",
    "old": "x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute('hidden')",
    "new": "x.nodeType === 1 && (x as Element).hasAttribute('hidden')",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M77",
    "guard": "outside an index, an exact ID is 10 characters or fewer",
    "file": "src/enhance/ids.ts",
    "old": "const EXACT_MAX = 10;",
    "new": "const EXACT_MAX = 11;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M78",
    "guard": "outside an index, the whole first cell is the ID",
    "file": "src/enhance/ids.ts",
    "old": "idAt(t) === t ? t : null",
    "new": "idAt(t) !== null ? idAt(t) : null",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M79",
    "guard": "an index has two rows or more",
    "file": "src/enhance/ids.ts",
    "old": "rows.length >= INDEX_ROWS && ",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M80",
    "guard": "an index has 60% of its first cells opening on an ID",
    "file": "src/enhance/ids.ts",
    "old": "const INDEX_SHARE = 0.6;",
    "new": "const INDEX_SHARE = 0.4;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M81",
    "guard": "blocks[].isIndex is written",
    "file": "src/enhance/ids.ts",
    "old": "    block.isIndex = isIndex;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M82",
    "guard": "an index defines each opening ID, another table only exact ones",
    "file": "src/enhance/ids.ts",
    "old": "(isIndex ? opening[i] : exact[i])",
    "new": "opening[i]",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M83",
    "guard": "idcell goes through the journal",
    "file": "src/enhance/ids.ts",
    "old": "      journal.toggleClass(r.cells[0] as HTMLTableCellElement, 'idcell', true);",
    "new": "      (r.cells[0] as HTMLTableCellElement).classList.add('idcell');",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M84",
    "guard": "a row ID over 200 code units is not defined",
    "file": "src/enhance/ids.ts",
    "old": "      if (id.length > NAME_MAX) return;\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M85",
    "guard": "the rest of the first cell drops a separator",
    "file": "src/enhance/ids.ts",
    "old": ".replace(/^[\\s,:.-]+/, '')",
    "new": ".replace(/^\\s+/, '')",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M86",
    "guard": "the rest is a title when longer than two characters",
    "file": "src/enhance/ids.ts",
    "old": "rest.length > 2 &&",
    "new": "rest.length > 0 &&",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M87",
    "guard": "the rest is a title when it opens on no ID",
    "file": "src/enhance/ids.ts",
    "old": "rest.length > 2 && !vocab.id.test(rest) ?",
    "new": "rest.length > 2 ?",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M88",
    "guard": "the title column, else the second cell",
    "file": "src/enhance/ids.ts",
    "old": "      const tc = r.cells[titleCol] ?? r.cells[1];",
    "new": "      const tc = r.cells[1];",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M89",
    "guard": "the title column comes after the first",
    "file": "src/enhance/ids.ts",
    "old": "findIndex((h, i) => i > 0 && vocab.titleHeader.test(h))",
    "new": "findIndex((h) => vocab.titleHeader.test(h))",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M90",
    "guard": "a row with no title cell has an empty title",
    "file": "src/enhance/ids.ts",
    "old": "tc === undefined ? '' : shown(tc)",
    "new": "shown(tc as Node)",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M91",
    "guard": "the status is the row's last pill",
    "file": "src/enhance/ids.ts",
    "old": "  const last = pills[pills.length - 1];",
    "new": "  const last = pills[0];",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M92",
    "guard": "the status is a chrome pill's (a document's own .pill is none)",
    "file": "src/enhance/ids.ts",
    "old": "Array.from(row.querySelectorAll('.pill')).filter((e) => e.hasAttribute(CHROME_ATTR))",
    "new": "Array.from(row.querySelectorAll('.pill'))",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M93",
    "guard": "a row with no pill has no status",
    "file": "src/enhance/ids.ts",
    "old": "  return last === undefined ? null : (ROLES",
    "new": "  return (ROLES",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M94",
    "guard": "the group is an h2 or h3 (an h4 is none)",
    "file": "src/enhance/ids.ts",
    "old": "      if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') {",
    "new": "      if (/^h[2-6]$/.test(p.localName) && p.id !== '') {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M95",
    "guard": "the group heading has an id",
    "file": "src/enhance/ids.ts",
    "old": " && p.id !== '') {",
    "new": ") {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M96",
    "guard": "a box of In short or Where things stand counts by its heading",
    "file": "src/enhance/ids.ts",
    "old": "      if (p.classList.contains('short') || p.classList.contains('callout')) {",
    "new": "      if (false) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M97",
    "guard": "the group is looked for up through the table's ancestors",
    "file": "src/enhance/ids.ts",
    "old": "        n = n.parentElement;\n        continue;",
    "new": "        break;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M98",
    "guard": "the group is looked for inside the root only",
    "file": "src/enhance/ids.ts",
    "old": "table; n !== null && n !== root; ) {",
    "new": "table; n !== null; ) {",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M99",
    "guard": "a table under no heading is grouped as Index",
    "file": "src/enhance/ids.ts",
    "old": "const group = g === null ? 'Index' : bare(g);",
    "new": "const group = g === null ? '' : bare(g);",
    "tests": "test/enhance-ids.test.ts"
  }
]
```

## Rows added in the review round: `src/enhance/rules.ts` and `src/enhance/ids.ts` (L2-T9-M100 to M105)

Guards the review found without a row (the callout arm of the group walk, where a note ends, the bold title as a direct child) and the guards of its fixes (an over-long rule ID in the rules index, a note's closing bracket in a span of its own, the group walk's kept answers).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T9-M100 | a box of Where things stand (a callout) counts by its heading | `src/enhance/ids.ts` | `p.classList.contains('short') \|\| p.classList.contains('callout')` → `p.classList.contains('short')` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the group: a Where things stand box before the table counts by its heading" |
| L2-T9-M101 | a note ends at its closing bracket: the bracket and full stop stay hidden, out of the info pill | `src/enhance/rules.ts` | `            last = journal.split(note, words.length);` → `            last = note;` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text" |
| L2-T9-M102 | the bold title is a direct child of the paragraph (a bold in the status em or a link is none) | `src/enhance/rules.ts` | `Array.from(p.children).find((c) => c.localName === 'strong')` → `p.querySelector('strong') ?? undefined` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title" |
| L2-T9-M103 | an over-long rule ID is listed by its ID alone in the rules index: no link, no pill, not counted | `src/enhance/rules.ts` | `    if (id.length > NAME_MAX) continue; ⏎     if (!rules.has(id)) rules.set(id, { title, status });` → `    if (!rules.has(id)) rules.set(id, { title, status }); ⏎     if (id.length > NAME_MAX) continue;` | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "a rule ID over 200 code units is listed by its ID alone: no link, no pill, and its status is not counted" |
| L2-T9-M104 | a note's closing bracket has a hidden span of its own (a host's normalize() cannot join it to its opening bracket) | `src/enhance/rules.ts` | `  journal.wrap(siblingRun(dash, note === null ? null : last), hiddenSpan(doc)); ⏎   if (close !== n…` → `  journal.wrap(siblingRun(dash, null), hiddenSpan(doc));` | `test/enhance-ids.test.ts`: 2 failed \| 41 passed (43). "two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill"; "a host that normalizes the root while enhanced gets the text back in order: no two parts of one text sit side by side" |
| L2-T9-M105 | the group walk keeps each answer for the elements it passed (linear, not once per table) | `src/enhance/ids.ts` | `    for (const e of passed) known.set(e, found); ⏎ ` → (deleted) | `test/enhance-ids.test.ts`: 1 failed \| 42 passed (43). "the group is found in linear time: four times the tables under one heading reads at most six times the siblings" |

```json
[
  {
    "id": "L2-T9-M100",
    "guard": "a box of Where things stand (a callout) counts by its heading",
    "file": "src/enhance/ids.ts",
    "old": "p.classList.contains('short') || p.classList.contains('callout')",
    "new": "p.classList.contains('short')",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M101",
    "guard": "a note ends at its closing bracket: the bracket and full stop stay hidden, out of the info pill",
    "file": "src/enhance/rules.ts",
    "old": "            last = journal.split(note, words.length);",
    "new": "            last = note;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M102",
    "guard": "the bold title is a direct child of the paragraph (a bold in the status em or a link is none)",
    "file": "src/enhance/rules.ts",
    "old": "Array.from(p.children).find((c) => c.localName === 'strong')",
    "new": "p.querySelector('strong') ?? undefined",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M103",
    "guard": "an over-long rule ID is listed by its ID alone in the rules index: no link, no pill, not counted",
    "file": "src/enhance/rules.ts",
    "old": "    if (id.length > NAME_MAX) continue;\n    if (!rules.has(id)) rules.set(id, { title, status });",
    "new": "    if (!rules.has(id)) rules.set(id, { title, status });\n    if (id.length > NAME_MAX) continue;",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M104",
    "guard": "a note's closing bracket has a hidden span of its own (a host's normalize() cannot join it to its opening bracket)",
    "file": "src/enhance/rules.ts",
    "old": "  journal.wrap(siblingRun(dash, note === null ? null : last), hiddenSpan(doc));\n  if (close !== null) journal.wrap(close, hiddenSpan(doc));",
    "new": "  journal.wrap(siblingRun(dash, null), hiddenSpan(doc));",
    "tests": "test/enhance-ids.test.ts"
  },
  {
    "id": "L2-T9-M105",
    "guard": "the group walk keeps each answer for the elements it passed (linear, not once per table)",
    "file": "src/enhance/ids.ts",
    "old": "    for (const e of passed) known.set(e, found);\n",
    "new": "",
    "tests": "test/enhance-ids.test.ts"
  }
]
```
## Visual check

A rules list in front matter and an ID table (`scripts/demo/samples/ids.md`: eight rule IDs, five rule paragraphs with
statuses and notes, a lettered section and an ID table with a status column), the facts panel open and closed, in
light and dark, at both viewports, on the code before the review round. Ours was the demo page built with `rules: true` (the demo builder passes no
plugin option, so a scratch copy of it added that one option); the reference was a temporary copy of the reference
reader serving the same sample from a temporary repository, on loopback.

`scripts/visual/compare.mjs` ran in the states light, dark, sans with wide, and two named states that flip the facts
panel (`toggled-light`, `toggled-dark`): with eight rules the panel is open at 1440 px and closed at 390 px on both
pages, and the flip shows the other state. In each of the ten combinations, 15 blocks are in both pages, and every
difference is one of two, both expected and both C43's: the front-matter strip and the meta line stay in the
document, hidden, where the reference drops them (`dl@1-5`, `p@9-9`, present in ours only); and at 1440 px the
blocks' auto margins resolve differently (328 px against 208 px), because the root owns its box and the reference's
page container is narrower and centred on a page without contents; every box is equal. Result: 0 unexpected
differences.

What compare.mjs does not measure, because it carries no `data-line`, was measured by a scratch script in the same
way (boxes from the title's origin, to 0.1 px, and computed values: display, colour, font size, weight and style,
line height, letter spacing, text transform, white space, margins, the left padding and border, the top border and
the gap; and the visible text): the facts panel, its summary and every part of it, the rules list, each item and
its children, the rule IDs, titles and pills, the panel's own key list, each rule paragraph, its head, the head's
codes and pills, each ID cell and each pill in the table. 82 elements in each page, in light and dark, open and
closed, at both viewports: 0 differences. The panel's open state matched the reference's in all eight.

The review round (`0baf415`) changed one thing that is drawn: a rule with a note has a third hidden span in its head,
its closing bracket's. Hidden spans take no box, which the browser case "a rule head shows its codes and pills only"
checks (L2-T9-M31), so the comparison was not run again. The sample has no status em that holds inline code: such a
pill holds the code itself, which takes the rule head's code style, where the reference's pill is plain text (a
recorded deviation; a reset belongs to `reader.css`, which is not this task's file).
