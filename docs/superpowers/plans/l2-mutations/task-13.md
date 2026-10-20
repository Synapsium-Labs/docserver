# L2 Task 13: mutation rows (cross-references and the glossary)

Each guard of Task 13, deleted or changed once, with the tests that go red: the walk both link features share
(`src/enhance/mentions.ts`), the cross-references (`src/enhance/xrefs.ts`), the glossary's tables, terms and links and
its term matcher (`src/enhance/glossary.ts`), RF3's bound, and three rows held by the Level 2 cases. Measured 2026-10-20
on branch `l2-t13-links` at commit `6e632a2`, every row, L2-T13-M1 to L2-T13-M152. All 152 are red (`rc=1`). Two later
commits add a case and change RF3's rounds, and change no code (`df5e0ff`, `3eb6060`); L2-T13-M149, whose case the
second changes, was measured again on `3eb6060`.

**The review's fixes** (commits `814b39d` to `27c8dba`) changed code: the term matcher stops at a run of white space no
term goes on through, and a table's section is found by one finder that remembers each element's answer. They add
twelve rows, L2-T13-M153 to L2-T13-M164, in a section of their own at the end. The eight rows whose `old` the finder
changed (L2-T13-M85 to L2-T13-M91, L2-T13-M94) were ported to it, same guard, same mutation, and measured again; so was
L2-T13-M149, whose case now judges the median of seven paired rounds. Those 21 rows were measured on `27c8dba`, and
their rows give those runs. All 164 rows are red (`rc=1`).

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), with the changes Task 7b's rows file records: a 512 MiB output
buffer, a run that ends with no exit status counted as no verdict (KILLED), and the `Errors`, `Unhandled Rejection` and
`TypeError` lines kept in what it prints. Each row is applied to its own throwaway copy of the working tree (tracked and
untracked files, never ignored ones, `node_modules` linked from the checkout), its tests run there with the local
`vitest`, and the copy is deleted. Each `old` occurs exactly once in its file. The rows ran with
`DOCREADER_BROWSERS=chromium` (C45): the Level 2 rows ran in Chromium, and WebKit was reported as excluded. They ran in
two batches side by side. The checkout was never edited: `git status --porcelain` read the same (empty) before and
after, and so did `HEAD` and the hash of `git diff`. The Red column gives the count line and the failing tests the run
printed (at most five here). Most rows run `test/enhance-links.test.ts` without its RF3 case (`-t '^(?!RF3)'`), which
takes over a minute alone; the RF3 row runs that case only.

Notes on the measurement.
- **A first pass, and what it found.** The rows were first measured on `2992d36`, the commit before the eyebrow was
  skipped (numbered here as in this file). Three were green and one was killed, and each now has a case, measured red
  here:
  - L2-T13-M32 (texts come in document order): every case named an ID or a term once per text, so reading a block's
    texts backwards changed nothing. A case now names them in two texts of one paragraph, and in two items of one list.
  - L2-T13-M98 (the In short box starts a new section): no case mentioned a term before the box. One now does.
  - L2-T13-M61 (a term cell's white space is squashed before its names are read): rendered cells hold no stray white
    space. A hand-written cell now holds white space at its ends and a line break inside.
  - L2-T13-M149 (RF3) was killed by `mutate.mjs`'s ten-minute limit: the case allowed itself fifteen. It now starts no
    round once its rounds have taken four minutes, and judges the bound on the rounds it finished (one at least).
- **The skip list.** The first pass left the eyebrow unskipped, on the reading that it never sits in a block. It does
  when the title does: a title in a quote or a list item, with front matter giving the document's kind, puts the eyebrow
  in that block, and an ID or a term it named was linked there. It is now skipped by name, as the reference layout's
  list does, with a case for each container (L2-T13-M21). The reference's list also names the "Where things stand" index
  and a task's id (`.task-id`); all of their text sits in links or in a heading, which the walk skips already, so no
  case could redden a skip of their own, and they have none. A case added after the measurement (`df5e0ff`) pins the
  index as unlinked in a quote, and goes red when links are no longer skipped.
- **What is not a guard here, and has no row.** Three pieces of code change no outcome when removed, so no case could
  redden them; each is named here instead.
  - `glossary.ts` keeps each glossary's heading for its rows' links (`hrefs.set(row, href)`): without it the heading is
    found again from the row, with the same answer. (Before the section finder remembered its answers, this cost grew
    with the square of one glossary's rows; the finder now reads each element once either way, and its own memory has
    rows, L2-T13-M160 and L2-T13-M161.)
  - `xrefs.ts` and `glossary.ts` return early when nothing is defined; each early return has a row all the same
    (L2-T13-M36, L2-T13-M95), measured by a case that counts the work done: the ID scans the vocabulary hands out, and
    the attributes the glossary reads.
  - TypeScript's narrowing (`m[1] ?? ''`, `found[i] as …`) marks values the code above already proved present.
- **Checks removed before measuring, because no case could redden them.** Past either end of a text `charCodeAt` answers
  NaN, which is no letter and no edge of the trie, so the matcher's bound tests at the text's two ends were removed
  (`mentionEnd`, the lookbehind and the walk). The "In short" and "Where things stand" boxes always hold the heading
  they start with, so the checks that one was found were removed. Keys reach the matcher squashed (`termKey`), so its
  collapsing of white-space runs inside a key was removed. A section's reset needs no h2 inside the "In short" box,
  which always holds one.
- **The Level 2 cases** hold the same guards as the jsdom cases; three rows show they bite in a real browser
  (L2-T13-M150 to M152).
- **RF3.** Its row rebuilds the term matcher for every text, so the glossary's cost grows with the number of terms as
  well as with the text, as the reference's pattern of every term would. On `3eb6060` it finished two rounds before the
  cap stopped it: the large plan took 19.4 and 56.8 s, and the plan twice as large 116.4 and 130.5 s, 6.0 times as long
  (bound 2.5). On `6e632a2` the same row took 19.9 and 37.4 s, then 114.4 and 138.6 s, 5.7 times. Both runs are red by
  the ratio; the large plan's best stayed just inside the 20 s budget. On `27c8dba`, with the case judging the median
  of paired rounds, it took 22.0 and 52.2 s, then 125.5 and 151.1 s (pairs 5.71 and 2.90, median 4.31) at a load
  average of about 21 to 28: red by the budget first, and by the ratio as well.
  The bound is measured in jsdom over seven rounds, each the large plan then the plan twice as large, timed back to
  back, each timed window starting after a full garbage collection; the ratio judged is the median of the seven pairs'
  ratios, and the budget holds the large plan's best. The large plan is mounted through `innerHTML` (jsdom keeps each
  document a `DOMParser` makes alive, about 65 MB per parse here, which slows every later round). The case first took
  the best of each scale over five rounds; the review measured that at 2.58 on honest code at a load average near 50
  (a lucky last round at one scale against a plateau at the other), where the same run's pairs measured 2.05 to 2.16,
  then 2.59. On `27c8dba`, in a throwaway copy whose case printed its numbers, four honest runs at a load average of 20
  to 28 measured medians of 2.11, 2.23, 2.22 and 2.15 (single pairs 1.66 to 2.66, so the median of seven fails only
  when four pairs cross the bound), the large plan's best 2.67 to 3.07 s (the budget is 20 s), with 18,828
  cross-references and 17,638 term links, then 37,524 and 35,133. The process's CPU time is steadier but measured 2.58
  and 2.64: V8's parallel collector does more work on the larger heap, off the main thread, so CPU time is not the
  reader's time; the case keeps the wall clock.
- **The matcher's oracle.** The cases hold the matcher to the reference's own pattern (built in the test, as the
  reference builds it) on 4,000 random sets of keys and texts and on every code unit. The long s is left out of the
  random alphabet: the language's rule keeps it apart from "s", as V8 does for one letter, but V8 folds the two together
  inside an alternation, so the reference's pattern answers differently by engine there.

## The walk both features share: `src/enhance/mentions.ts` (L2-T13-M1 to L2-T13-M35)

Which texts are read and which block each counts in, what both features leave alone, the walk itself, and the split and wrap.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M1 | a paragraph is a block a mention is counted in | `src/enhance/mentions.ts` | `const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];` → `const BOXES: readonly string[] = ['li', 'td', 'dd', 'blockquote'];` | `test/enhance-links.test.ts` (all but RF3): 35 failed \| 14 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "what a fold hides until found is still read; what the layout hid is not"; "text outside a block is not linked: a summary, a figure's caption, a table head, the eyebrow" and 30 more |
| L2-T13-M2 | a list item is a block a mention is counted in | `src/enhance/mentions.ts` | `const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];` → `const BOXES: readonly string[] = ['p', 'td', 'dd', 'blockquote'];` | `test/enhance-links.test.ts` (all but RF3): 6 failed \| 43 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped"; "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "the first mention is the first in document order: across the texts of one block, and across the items of one list" and 1 more |
| L2-T13-M3 | a table cell is a block a mention is counted in | `src/enhance/mentions.ts` | `const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];` → `const BOXES: readonly string[] = ['p', 'li', 'dd', 'blockquote'];` | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a mention inside its own target is not linked; a mention of another ID there is"; "an xref and a term never overlap: the glossary reads no link, and an ID is never a term" |
| L2-T13-M4 | a description (a front-matter strip still shown) is a block a mention is counted in | `src/enhance/mentions.ts` | `const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];` → `const BOXES: readonly string[] = ['p', 'li', 'td', 'blockquote'];` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" |
| L2-T13-M5 | a quote holding text of its own is a block a mention is counted in | `src/enhance/mentions.ts` | `const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];` → `const BOXES: readonly string[] = ['p', 'li', 'td', 'dd'];` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped" |
| L2-T13-M6 | a link holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th'…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M7 | inline code holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', '…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M8 | a pre without code holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', …` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped" |
| L2-T13-M9 | a keyboard key holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', …` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M10 | an h1 inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h2', 'h3', 'h4', 'h5', 'h6', 'th',…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" |
| L2-T13-M11 | an h2 inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h3', 'h4', 'h5', 'h6', 'th',…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" |
| L2-T13-M12 | an h3 inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h4', 'h5', 'h6', 'th',…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M13 | an h4 inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h5', 'h6', 'th',…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" |
| L2-T13-M14 | an h5 inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h6', 'th',…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" |
| L2-T13-M15 | an h6 inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'th',…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" |
| L2-T13-M16 | a table head inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M17 | a figure inside a list item holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M18 | the layout's button holds no mention | `src/enhance/mentions.ts` | `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` → `const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "skips a rule head, a step number and a button, and hidden text" |
| L2-T13-M19 | the byline holds no mention | `src/enhance/mentions.ts` | `  if (el === page.byline \|\| el === page.facts.panel) return true;` → `  if (el === page.facts.panel) return true;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M20 | the facts panel holds no mention | `src/enhance/mentions.ts` | `  if (el === page.byline \|\| el === page.facts.panel) return true;` → `  if (el === page.byline) return true;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel" |
| L2-T13-M21 | the eyebrow holds no mention (in a block when the title is) | `src/enhance/mentions.ts` | `  if (el.classList.contains('eyebrow') \|\| el.classList.contains('rule-head') \|\| el.classList.contain…` → `  if (el.classList.contains('rule-head') \|\| el.classList.contains('step-no')) return true;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)" |
| L2-T13-M22 | a rule's head holds no mention | `src/enhance/mentions.ts` | `  if (el.classList.contains('eyebrow') \|\| el.classList.contains('rule-head') \|\| el.classList.contain…` → `  if (el.classList.contains('eyebrow') \|\| el.classList.contains('step-no')) return true;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "skips a rule head, a step number and a button, and hidden text" |
| L2-T13-M23 | a step's number holds no mention | `src/enhance/mentions.ts` | `  if (el.classList.contains('eyebrow') \|\| el.classList.contains('rule-head') \|\| el.classList.contain…` → `  if (el.classList.contains('eyebrow') \|\| el.classList.contains('rule-head')) return true;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "skips a rule head, a step number and a button, and hidden text" |
| L2-T13-M24 | what the layout hid holds no mention | `src/enhance/mentions.ts` | `  return hidden !== null && hidden !== 'until-found';` → `  return false;` | `test/enhance-links.test.ts` (all but RF3): 5 failed \| 44 passed \| 1 skipped (50). "what a fold hides until found is still read; what the layout hid is not"; "text outside a block is not linked: a summary, a figure's caption, a table head, the eyebrow"; "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel"; "skips a rule head, a step number and a button, and hidden text" |
| L2-T13-M25 | what a fold hides until found is still read | `src/enhance/mentions.ts` | `  return hidden !== null && hidden !== 'until-found';` → `  return hidden !== null;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "what a fold hides until found is still read; what the layout hid is not" |
| L2-T13-M26 | a skipped top-level element is not walked | `src/enhance/mentions.ts` | `  if (skip(top)) return out; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 20 failed \| 29 passed \| 1 skipped (50). "what a fold hides until found is still read; what the layout hid is not"; "text outside a block is not linked: a summary, a figure's caption, a table head, the eyebrow"; "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button"; "a comment node in a block is passed over, and the text around it is read" and 15 more |
| L2-T13-M27 | a top-level block is a block | `src/enhance/mentions.ts` | `[{ node: top, box: BOXES.includes(top.localName) ? top : null }]` → `[{ node: top, box: null }]` | `test/enhance-links.test.ts` (all but RF3): 35 failed \| 14 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped"; "what a fold hides until found is still read; what the layout hid is not" and 30 more |
| L2-T13-M28 | a text in no block is not read | `src/enhance/mentions.ts` | `        if (box !== null) stack.push({ node: c, box });` → `        stack.push({ node: c, box });` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "text outside a block is not linked: a summary, a figure's caption, a table head, the eyebrow" |
| L2-T13-M29 | a comment is passed over | `src/enhance/mentions.ts` | `      if (c.nodeType !== 1 \|\| skip(c as Element)) continue;` → `      if (skip(c as Element)) continue;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a comment node in a block is passed over, and the text around it is read" |
| L2-T13-M30 | a skipped element is not walked | `src/enhance/mentions.ts` | `      if (c.nodeType !== 1 \|\| skip(c as Element)) continue;` → `      if (c.nodeType !== 1) continue;` | `test/enhance-links.test.ts` (all but RF3): 7 failed \| 42 passed \| 1 skipped (50). "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped"; "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "skips the layout's own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button" and 2 more |
| L2-T13-M31 | a block inside the top element is the mention's block | `src/enhance/mentions.ts` | `box: BOXES.includes((c as Element).localName) ? (c as Element) : box` → `box: box` | `test/enhance-links.test.ts` (all but RF3): 12 failed \| 37 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a mention inside its own target is not linked; a mention of another ID there is"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped"; "text outside a block is not linked: a summary, a figure's caption, a table head, the eyebrow" and 7 more |
| L2-T13-M32 | texts come in document order | `src/enhance/mentions.ts` | `    for (let c = node.lastChild; c !== null; c = c.previousSibling) {` → `    for (let c = node.firstChild; c !== null; c = c.nextSibling) {` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "the first mention is the first in document order: across the texts of one block, and across the items of one list" |
| L2-T13-M33 | the root's children are walked, never read from the live list | `src/enhance/mentions.ts` | `  for (let c = root.firstElementChild; c !== null; c = c.nextElementSibling) out.push(c);` → `  out.push(...Array.from(root.children));` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "xrefs and the glossary find the root's blocks by walking its children, never through its live children list" |
| L2-T13-M34 | a mention at the start of a text is not split before | `src/enhance/mentions.ts` | `  const mid = at > 0 ? journal.split(text, at) : text;` → `  const mid = journal.split(text, at);` | `test/enhance-links.test.ts` (all but RF3): 12 failed \| 37 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "a mention inside its own target is not linked; a mention of another ID there is"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped" and 7 more |
| L2-T13-M35 | a mention at the end of a text is not split after | `src/enhance/mentions.ts` | `  const after = length < mid.data.length ? journal.split(mid, length) : null;` → `  const after = journal.split(mid, length);` | `test/enhance-links.test.ts` (all but RF3): 8 failed \| 41 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "a mention inside its own target is not linked; a mention of another ID there is"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "with no defined ID, no text is scanned; with one, each text is scanned once" and 3 more |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M1",
    "guard": "a paragraph is a block a mention is counted in",
    "file": "src/enhance/mentions.ts",
    "old": "const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];",
    "new": "const BOXES: readonly string[] = ['li', 'td', 'dd', 'blockquote'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M2",
    "guard": "a list item is a block a mention is counted in",
    "file": "src/enhance/mentions.ts",
    "old": "const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];",
    "new": "const BOXES: readonly string[] = ['p', 'td', 'dd', 'blockquote'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M3",
    "guard": "a table cell is a block a mention is counted in",
    "file": "src/enhance/mentions.ts",
    "old": "const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];",
    "new": "const BOXES: readonly string[] = ['p', 'li', 'dd', 'blockquote'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M4",
    "guard": "a description (a front-matter strip still shown) is a block a mention is counted in",
    "file": "src/enhance/mentions.ts",
    "old": "const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];",
    "new": "const BOXES: readonly string[] = ['p', 'li', 'td', 'blockquote'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M5",
    "guard": "a quote holding text of its own is a block a mention is counted in",
    "file": "src/enhance/mentions.ts",
    "old": "const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];",
    "new": "const BOXES: readonly string[] = ['p', 'li', 'td', 'dd'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M6",
    "guard": "a link holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M7",
    "guard": "inline code holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M8",
    "guard": "a pre without code holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M9",
    "guard": "a keyboard key holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M10",
    "guard": "an h1 inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M11",
    "guard": "an h2 inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M12",
    "guard": "an h3 inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M13",
    "guard": "an h4 inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h5', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M14",
    "guard": "an h5 inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h6', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M15",
    "guard": "an h6 inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'th', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M16",
    "guard": "a table head inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M17",
    "guard": "a figure inside a list item holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'button'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M18",
    "guard": "the layout's button holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];",
    "new": "const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure'];",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M19",
    "guard": "the byline holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "  if (el === page.byline || el === page.facts.panel) return true;",
    "new": "  if (el === page.facts.panel) return true;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M20",
    "guard": "the facts panel holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "  if (el === page.byline || el === page.facts.panel) return true;",
    "new": "  if (el === page.byline) return true;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M21",
    "guard": "the eyebrow holds no mention (in a block when the title is)",
    "file": "src/enhance/mentions.ts",
    "old": "  if (el.classList.contains('eyebrow') || el.classList.contains('rule-head') || el.classList.contains('step-no')) return true;",
    "new": "  if (el.classList.contains('rule-head') || el.classList.contains('step-no')) return true;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M22",
    "guard": "a rule's head holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "  if (el.classList.contains('eyebrow') || el.classList.contains('rule-head') || el.classList.contains('step-no')) return true;",
    "new": "  if (el.classList.contains('eyebrow') || el.classList.contains('step-no')) return true;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M23",
    "guard": "a step's number holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "  if (el.classList.contains('eyebrow') || el.classList.contains('rule-head') || el.classList.contains('step-no')) return true;",
    "new": "  if (el.classList.contains('eyebrow') || el.classList.contains('rule-head')) return true;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M24",
    "guard": "what the layout hid holds no mention",
    "file": "src/enhance/mentions.ts",
    "old": "  return hidden !== null && hidden !== 'until-found';",
    "new": "  return false;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M25",
    "guard": "what a fold hides until found is still read",
    "file": "src/enhance/mentions.ts",
    "old": "  return hidden !== null && hidden !== 'until-found';",
    "new": "  return hidden !== null;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M26",
    "guard": "a skipped top-level element is not walked",
    "file": "src/enhance/mentions.ts",
    "old": "  if (skip(top)) return out;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M27",
    "guard": "a top-level block is a block",
    "file": "src/enhance/mentions.ts",
    "old": "[{ node: top, box: BOXES.includes(top.localName) ? top : null }]",
    "new": "[{ node: top, box: null }]",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M28",
    "guard": "a text in no block is not read",
    "file": "src/enhance/mentions.ts",
    "old": "        if (box !== null) stack.push({ node: c, box });",
    "new": "        stack.push({ node: c, box });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M29",
    "guard": "a comment is passed over",
    "file": "src/enhance/mentions.ts",
    "old": "      if (c.nodeType !== 1 || skip(c as Element)) continue;",
    "new": "      if (skip(c as Element)) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M30",
    "guard": "a skipped element is not walked",
    "file": "src/enhance/mentions.ts",
    "old": "      if (c.nodeType !== 1 || skip(c as Element)) continue;",
    "new": "      if (c.nodeType !== 1) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M31",
    "guard": "a block inside the top element is the mention's block",
    "file": "src/enhance/mentions.ts",
    "old": "box: BOXES.includes((c as Element).localName) ? (c as Element) : box",
    "new": "box: box",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M32",
    "guard": "texts come in document order",
    "file": "src/enhance/mentions.ts",
    "old": "    for (let c = node.lastChild; c !== null; c = c.previousSibling) {",
    "new": "    for (let c = node.firstChild; c !== null; c = c.nextSibling) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M33",
    "guard": "the root's children are walked, never read from the live list",
    "file": "src/enhance/mentions.ts",
    "old": "  for (let c = root.firstElementChild; c !== null; c = c.nextElementSibling) out.push(c);",
    "new": "  out.push(...Array.from(root.children));",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M34",
    "guard": "a mention at the start of a text is not split before",
    "file": "src/enhance/mentions.ts",
    "old": "  const mid = at > 0 ? journal.split(text, at) : text;",
    "new": "  const mid = journal.split(text, at);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M35",
    "guard": "a mention at the end of a text is not split after",
    "file": "src/enhance/mentions.ts",
    "old": "  const after = length < mid.data.length ? journal.split(mid, length) : null;",
    "new": "  const after = journal.split(mid, length);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  }
]
```

## Cross-references: `src/enhance/xrefs.ts` (L2-T13-M36 to L2-T13-M52)

The empty index, the qualifier and its window, the first mention per block, a mention inside its own target, the link and its attributes.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M36 | with no defined ID, no text is scanned | `src/enhance/xrefs.ts` | `  if (index.all().length === 0) return; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "with no defined ID, no text is scanned; with one, each text is scanned once" |
| L2-T13-M37 | the qualifier's window holds its longest word | `src/enhance/xrefs.ts` | `  const reach = QUAL_WINDOW + vocab.words.qualifiers.reduce((n, w) => Math.max(n, w.length), 0);` → `  const reach = QUAL_WINDOW;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "the qualifier is read only in a window before the mention: its longest word and 24 more code units" |
| L2-T13-M38 | the qualifier window is 24 code units beyond the word | `src/enhance/xrefs.ts` | `export const QUAL_WINDOW = 24;` → `export const QUAL_WINDOW = 25;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "the qualifier is read only in a window before the mention: its longest word and 24 more code units" |
| L2-T13-M39 | the qualifier is read only in its window | `src/enhance/xrefs.ts` | `s.slice(Math.max(0, m.index - reach), m.index)` → `s.slice(0, m.index)` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "the qualifier is read only in a window before the mention: its longest word and 24 more code units" |
| L2-T13-M40 | the window starts no earlier than the text | `src/enhance/xrefs.ts` | `s.slice(Math.max(0, m.index - reach), m.index)` → `s.slice(m.index - reach, m.index)` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "an ID that is not defined, or that a qualifier word just before names as another document's, is not linked" |
| L2-T13-M41 | an ID the index does not define is left | `src/enhance/xrefs.ts` | `        if (entry === undefined \|\| seen.has(id)) continue;` → `        if (seen.has(id)) continue;` | `test/enhance-links.test.ts` (all but RF3): 9 failed \| 40 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "a mention inside its own target is not linked; a mention of another ID there is"; "an ID that is not defined, or that a qualifier word just before names as another document's, is not linked"; "with no defined ID, no text is scanned; with one, each text is scanned once" and 4 more |
| L2-T13-M42 | a second mention in a block is left | `src/enhance/xrefs.ts` | `        if (entry === undefined \|\| seen.has(id)) continue;` → `        if (entry === undefined) continue;` | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a mention inside its own target is not linked; a mention of another ID there is"; "an xref and a term never overlap: the glossary reads no link, and an ID is never a term" |
| L2-T13-M43 | a mention inside its own target is left | `src/enhance/xrefs.ts` | `        if (entry.target.contains(text)) continue; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 14 failed \| 35 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a mention inside its own target is not linked; a mention of another ID there is"; "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped" and 9 more |
| L2-T13-M44 | a mention a qualifier names is left | `src/enhance/xrefs.ts` | `        if (vocab.qualifier.test(s.slice(Math.max(0, m.index - reach), m.index))) continue; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "an ID that is not defined, or that a qualifier word just before names as another document's, is not linked"; "the qualifier is read only in a window before the mention: its longest word and 24 more code units" |
| L2-T13-M45 | a linked ID is remembered for its block | `src/enhance/xrefs.ts` | `        seen.add(id); ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a mention inside its own target is not linked; a mention of another ID there is"; "an xref and a term never overlap: the glossary reads no link, and an ID is never a term" |
| L2-T13-M46 | each block keeps its own linked IDs | `src/enhance/xrefs.ts` | `      let seen = done.get(box);` → `      let seen = done.values().next().value;` | `test/enhance-links.test.ts` (all but RF3): 10 failed \| 39 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read"; "in hand-written html: text straight in a quote is in a block, and a pre without code is skipped"; "what a fold hides until found is still read; what the layout hid is not" and 5 more |
| L2-T13-M47 | links are made last first, so each offset holds | `src/enhance/xrefs.ts` | `      for (let i = found.length - 1; i >= 0; i -= 1) {` → `      for (let i = 0; i < found.length; i += 1) {` | `test/enhance-links.test.ts` (all but RF3): 8 failed \| 41 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "a mention inside its own target is not linked; a mention of another ID there is"; "with no defined ID, no text is scanned; with one, each text is scanned once"; "xrefs and the glossary find the root's blocks by walking its children, never through its live children list" and 3 more |
| L2-T13-M48 | the href escapes the ID for a fragment | `src/enhance/xrefs.ts` | `href: `#${encodeURIComponent(id)}`` → `href: `#${id}`` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "an ID whose text needs escaping in a fragment is written escaped, and nav decodes it" |
| L2-T13-M49 | a link names its ID (data-ref) | `src/enhance/xrefs.ts` | `'data-ref': id, ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false"" |
| L2-T13-M50 | a link says it opens a dialog (aria-haspopup) | `src/enhance/xrefs.ts` | `'aria-haspopup': 'dialog', 'aria-expanded': 'false' }` → `'aria-expanded': 'false' }` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false"" |
| L2-T13-M51 | a link says it is closed (aria-expanded) | `src/enhance/xrefs.ts` | `'aria-haspopup': 'dialog', 'aria-expanded': 'false' }` → `'aria-haspopup': 'dialog' }` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false"" |
| L2-T13-M52 | a link is an a.xref | `src/enhance/xrefs.ts` | `          className: 'xref',` → `          className: 'ref',` | `test/enhance-links.test.ts` (all but RF3): 20 failed \| 29 passed \| 1 skipped (50). "links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote"; "a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false""; "a mention inside its own target is not linked; a mention of another ID there is"; "skips the document's own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block"; "a heading of any level inside a list item is skipped; a front-matter strip still shown is read" and 15 more |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M36",
    "guard": "with no defined ID, no text is scanned",
    "file": "src/enhance/xrefs.ts",
    "old": "  if (index.all().length === 0) return;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M37",
    "guard": "the qualifier's window holds its longest word",
    "file": "src/enhance/xrefs.ts",
    "old": "  const reach = QUAL_WINDOW + vocab.words.qualifiers.reduce((n, w) => Math.max(n, w.length), 0);",
    "new": "  const reach = QUAL_WINDOW;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M38",
    "guard": "the qualifier window is 24 code units beyond the word",
    "file": "src/enhance/xrefs.ts",
    "old": "export const QUAL_WINDOW = 24;",
    "new": "export const QUAL_WINDOW = 25;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M39",
    "guard": "the qualifier is read only in its window",
    "file": "src/enhance/xrefs.ts",
    "old": "s.slice(Math.max(0, m.index - reach), m.index)",
    "new": "s.slice(0, m.index)",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M40",
    "guard": "the window starts no earlier than the text",
    "file": "src/enhance/xrefs.ts",
    "old": "s.slice(Math.max(0, m.index - reach), m.index)",
    "new": "s.slice(m.index - reach, m.index)",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M41",
    "guard": "an ID the index does not define is left",
    "file": "src/enhance/xrefs.ts",
    "old": "        if (entry === undefined || seen.has(id)) continue;",
    "new": "        if (seen.has(id)) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M42",
    "guard": "a second mention in a block is left",
    "file": "src/enhance/xrefs.ts",
    "old": "        if (entry === undefined || seen.has(id)) continue;",
    "new": "        if (entry === undefined) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M43",
    "guard": "a mention inside its own target is left",
    "file": "src/enhance/xrefs.ts",
    "old": "        if (entry.target.contains(text)) continue;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M44",
    "guard": "a mention a qualifier names is left",
    "file": "src/enhance/xrefs.ts",
    "old": "        if (vocab.qualifier.test(s.slice(Math.max(0, m.index - reach), m.index))) continue;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M45",
    "guard": "a linked ID is remembered for its block",
    "file": "src/enhance/xrefs.ts",
    "old": "        seen.add(id);\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M46",
    "guard": "each block keeps its own linked IDs",
    "file": "src/enhance/xrefs.ts",
    "old": "      let seen = done.get(box);",
    "new": "      let seen = done.values().next().value;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M47",
    "guard": "links are made last first, so each offset holds",
    "file": "src/enhance/xrefs.ts",
    "old": "      for (let i = found.length - 1; i >= 0; i -= 1) {",
    "new": "      for (let i = 0; i < found.length; i += 1) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M48",
    "guard": "the href escapes the ID for a fragment",
    "file": "src/enhance/xrefs.ts",
    "old": "href: `#${encodeURIComponent(id)}`",
    "new": "href: `#${id}`",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M49",
    "guard": "a link names its ID (data-ref)",
    "file": "src/enhance/xrefs.ts",
    "old": "'data-ref': id, ",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M50",
    "guard": "a link says it opens a dialog (aria-haspopup)",
    "file": "src/enhance/xrefs.ts",
    "old": "'aria-haspopup': 'dialog', 'aria-expanded': 'false' }",
    "new": "'aria-expanded': 'false' }",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M51",
    "guard": "a link says it is closed (aria-expanded)",
    "file": "src/enhance/xrefs.ts",
    "old": "'aria-haspopup': 'dialog', 'aria-expanded': 'false' }",
    "new": "'aria-haspopup': 'dialog' }",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M52",
    "guard": "a link is an a.xref",
    "file": "src/enhance/xrefs.ts",
    "old": "          className: 'xref',",
    "new": "          className: 'ref',",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  }
]
```

## The glossary, what makes one and its terms: `src/enhance/glossary.ts` (L2-T13-M53 to L2-T13-M91)

What a glossary is, its section and the heading's words, each row's names, and what is defined.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M53 | a glossary has two columns | `src/enhance/glossary.ts` | `    if (b.kind !== 'table' \|\| b.heads.length !== 2) continue;` → `    if (b.kind !== 'table') continue;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not" |
| L2-T13-M54 | a glossary's first head is a term head | `src/enhance/glossary.ts` | `    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '') && vocab.glossary.meaning.test(b.head…` → `    const byHeads = vocab.glossary.meaning.test(b.heads[1] ?? '');` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not" |
| L2-T13-M55 | a glossary's second head is a meaning head | `src/enhance/glossary.ts` | `    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '') && vocab.glossary.meaning.test(b.head…` → `    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '');` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not" |
| L2-T13-M56 | a table in a glossary's section is one | `src/enhance/glossary.ts` | `    if (!byHeads && !vocab.glossary.section.test(section)) continue;` → `    if (!byHeads) continue;` | `test/enhance-links.test.ts` (all but RF3): 15 failed \| 34 passed \| 1 skipped (50). "xrefs and the glossary find the root's blocks by walking its children, never through its live children list"; "a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged"; "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "with no term, the glossary reads no text" and 10 more |
| L2-T13-M57 | the block's glossary flag is set | `src/enhance/glossary.ts` | `    b.glossary = true; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged" |
| L2-T13-M58 | a glossary's wrapper is marked glossary | `src/enhance/glossary.ts` | `    journal.toggleClass(b.el, 'glossary', true); ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 18 failed \| 31 passed \| 1 skipped (50). "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "a comment node in a block is passed over, and the text around it is read"; "a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" and 13 more |
| L2-T13-M59 | a row of one cell names no term | `src/enhance/glossary.ts` | `      if (cell === undefined \|\| meaning === undefined) continue; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "in hand-written html, a glossary row with one cell names no term" |
| L2-T13-M60 | a row's first cell is marked termcell | `src/enhance/glossary.ts` | `      journal.toggleClass(cell, 'termcell', true); ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged"; "in hand-written html, a glossary row with one cell names no term"; "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M61 | a term cell's white space is squashed before its names are read | `src/enhance/glossary.ts` | `      const raw = squash(cell.textContent);` → `      const raw = cell.textContent ?? '';` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "in hand-written html, a term cell is read as its words: white space at its ends and line breaks inside count as one space" |
| L2-T13-M62 | a term cell over 48 characters names no term | `src/enhance/glossary.ts` | `      if (raw.length > TERM_CELL_MAX \|\| vocab.glossary.notTerm.test(raw)) continue;` → `      if (vocab.glossary.notTerm.test(raw)) continue;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M63 | a term cell holds at most 48 characters | `src/enhance/glossary.ts` | `export const TERM_CELL_MAX = 48;` → `export const TERM_CELL_MAX = 49;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M64 | a not-a-term cell ("IDs", "Codes") names no term | `src/enhance/glossary.ts` | `      if (raw.length > TERM_CELL_MAX \|\| vocab.glossary.notTerm.test(raw)) continue;` → `      if (raw.length > TERM_CELL_MAX) continue;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "in hand-written html, a term cell is read as its words: white space at its ends and line breaks inside count as one space"; "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M65 | a name shorter than three characters is no term | `src/enhance/glossary.ts` | `        if (name.length < TERM_NAME_MIN \|\| vocab.id.test(name) \|\| vocab.ruleId.test(name)) continue;` → `        if (vocab.id.test(name) \|\| vocab.ruleId.test(name)) continue;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M66 | a name has three characters or more | `src/enhance/glossary.ts` | `export const TERM_NAME_MIN = 3;` → `export const TERM_NAME_MIN = 2;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M67 | a name that is an ID is no term | `src/enhance/glossary.ts` | `        if (name.length < TERM_NAME_MIN \|\| vocab.id.test(name) \|\| vocab.ruleId.test(name)) continue;` → `        if (name.length < TERM_NAME_MIN \|\| vocab.ruleId.test(name)) continue;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID"; "an xref and a term never overlap: the glossary reads no link, and an ID is never a term" |
| L2-T13-M68 | a name that is a rule ID is no term | `src/enhance/glossary.ts` | `        if (name.length < TERM_NAME_MIN \|\| vocab.id.test(name) \|\| vocab.ruleId.test(name)) continue;` → `        if (name.length < TERM_NAME_MIN \|\| vocab.id.test(name)) continue;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID" |
| L2-T13-M69 | a term's target is its row | `src/enhance/glossary.ts` | `terms.define({ name, exact, section, target: row,` → `terms.define({ name, exact, section, target: cell,` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a plain click goes to the term's row (focused), not the heading its href names; the host hears no id" |
| L2-T13-M70 | a definition keeps the row's qualifier | `src/enhance/glossary.ts` | `def: { qual, cell: meaning, row } });` → `def: { qual: '', cell: meaning, row } });` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names" |
| L2-T13-M71 | a definition's cell is the meaning | `src/enhance/glossary.ts` | `def: { qual, cell: meaning, row } });` → `def: { qual, cell, row } });` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names" |
| L2-T13-M72 | a term keeps its glossary's section | `src/enhance/glossary.ts` | `terms.define({ name, exact, section, target: row,` → `terms.define({ name, exact, section: '', target: row,` | `test/enhance-links.test.ts` (all but RF3): 5 failed \| 44 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id"; "a table nested in a list item finds its section above the list; a heading id is escaped in the href"; "a numbered or lettered heading counts by its words, and a glossary under an h3 by the h3"; "a section's words leave out a button the layout put in its heading" |
| L2-T13-M73 | a term keeps whether it is exact | `src/enhance/glossary.ts` | `terms.define({ name, exact, section, target: row,` → `terms.define({ name, exact: false, section, target: row,` | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name"; "links the first mention per section; an h2 starts a new one, and so does the In short box"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact" |
| L2-T13-M74 | "Name (x)": x is an alias | `src/enhance/glossary.ts` | `    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });` → `    if (false) names.push({ name: x, exact: false });` | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "in hand-written html, a term cell is read as its words: white space at its ends and line breaks inside count as one space"; "links the first mention per section; an h2 starts a new one, and so does the In short box" |
| L2-T13-M75 | an alias is one word | `src/enhance/glossary.ts` | `    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });` → `    if (!vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names" |
| L2-T13-M76 | an alias stop word qualifies, it is no alias | `src/enhance/glossary.ts` | `    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });` → `    if (ALIAS.test(x)) names.push({ name: x, exact: false });` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "links the first mention per section; an h2 starts a new one, and so does the In short box" |
| L2-T13-M77 | what is not an alias qualifies the definition | `src/enhance/glossary.ts` | `    else qual = x;` → `    else qual = '';` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names" |
| L2-T13-M78 | "Name (x)" names Name | `src/enhance/glossary.ts` | `  const base = pm === null ? raw : (pm[1] ?? '');` → `  const base = raw;` | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "in hand-written html, a term cell is read as its words: white space at its ends and line breaks inside count as one space"; "refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID"; "links the first mention per section; an h2 starts a new one, and so does the In short box" |
| L2-T13-M79 | an empty part between joins is dropped | `src/enhance/glossary.ts` | `.filter((x) => x !== '')` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name" |
| L2-T13-M80 | a cell of one part is one name, not exact | `src/enhance/glossary.ts` | `  if (parts.length > 1 && parts.every((x) => words(x) <= 3))` → `  if (parts.every((x) => words(x) <= 3))` | `test/enhance-links.test.ts` (all but RF3): 19 failed \| 30 passed \| 1 skipped (50). "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "a comment node in a block is passed over, and the text around it is read"; "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" and 14 more |
| L2-T13-M81 | a part of four words keeps the cell one name | `src/enhance/glossary.ts` | `parts.every((x) => words(x) <= 3)` → `parts.every((x) => words(x) <= 4)` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name" |
| L2-T13-M82 | a cell's exact names are defined last first, as the reference does | `src/enhance/glossary.ts` | `for (const x of parts) names.unshift({ name: x, exact: true });` → `for (const x of parts) names.push({ name: x, exact: true });` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name" |
| L2-T13-M83 | a heading's words leave out its section number | `src/enhance/glossary.ts` | `  return headingText(h, isButton).replace(SEC_NO, '');` → `  return headingText(h, isButton);` | `test/enhance-links.test.ts` (all but RF3): 12 failed \| 37 passed \| 1 skipped (50). "xrefs and the glossary find the root's blocks by walking its children, never through its live children list"; "a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged"; "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "with no term, the glossary reads no text" and 7 more |
| L2-T13-M84 | a heading's words leave out the layout's buttons | `src/enhance/glossary.ts` | `const isButton = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR)…` → `const isButton = (el: Element): boolean => false;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a section's words leave out a button the layout put in its heading" |
| L2-T13-M85 | a section heading has an id | `src/enhance/glossary.ts` | `  if ((p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== '') return p;` → `  if (p.localName === 'h2' \|\| p.localName === 'h3') return p;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" |
| L2-T13-M86 | an h2 is a section heading | `src/enhance/glossary.ts` | `  if ((p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== '') return p;` → `  if (p.localName === 'h3' && p.id !== '') return p;` | `test/enhance-links.test.ts` (all but RF3): 17 failed \| 37 passed \| 1 skipped (55). "xrefs and the glossary find the root's blocks by walking its children, never through its live children list"; "a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged"; "defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "with no term, the glossary reads no text" and 12 more |
| L2-T13-M87 | an h3 is a section heading | `src/enhance/glossary.ts` | `  if ((p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== '') return p;` → `  if (p.localName === 'h2' && p.id !== '') return p;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a numbered or lettered heading counts by its words, and a glossary under an h3 by the h3" |
| L2-T13-M88 | an In short box's heading is a section | `src/enhance/glossary.ts` | `  if (p.classList.contains('short') \|\| p.classList.contains('callout')) return p.querySelector('h2, …` → `  if (p.classList.contains('callout')) return p.querySelector('h2, h3');` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" |
| L2-T13-M89 | a Where things stand box's heading is a section | `src/enhance/glossary.ts` | `  if (p.classList.contains('short') \|\| p.classList.contains('callout')) return p.querySelector('h2, …` → `  if (p.classList.contains('short')) return p.querySelector('h2, h3');` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" |
| L2-T13-M90 | a nested table's section is found above it | `src/enhance/glossary.ts` | `        n = n.parentElement;` → `        n = null;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a table nested in a list item finds its section above the list; a heading id is escaped in the href" |
| L2-T13-M91 | the section is looked for inside the root only | `src/enhance/glossary.ts` | `    for (let n: Element \| null = node; n !== null && n !== root; ) {` → `    for (let n: Element \| null = node; n !== null; ) {` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a term with no heading before its target, in the root, has the empty fragment for its href" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M53",
    "guard": "a glossary has two columns",
    "file": "src/enhance/glossary.ts",
    "old": "    if (b.kind !== 'table' || b.heads.length !== 2) continue;",
    "new": "    if (b.kind !== 'table') continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M54",
    "guard": "a glossary's first head is a term head",
    "file": "src/enhance/glossary.ts",
    "old": "    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '') && vocab.glossary.meaning.test(b.heads[1] ?? '');",
    "new": "    const byHeads = vocab.glossary.meaning.test(b.heads[1] ?? '');",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M55",
    "guard": "a glossary's second head is a meaning head",
    "file": "src/enhance/glossary.ts",
    "old": "    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '') && vocab.glossary.meaning.test(b.heads[1] ?? '');",
    "new": "    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '');",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M56",
    "guard": "a table in a glossary's section is one",
    "file": "src/enhance/glossary.ts",
    "old": "    if (!byHeads && !vocab.glossary.section.test(section)) continue;",
    "new": "    if (!byHeads) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M57",
    "guard": "the block's glossary flag is set",
    "file": "src/enhance/glossary.ts",
    "old": "    b.glossary = true;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M58",
    "guard": "a glossary's wrapper is marked glossary",
    "file": "src/enhance/glossary.ts",
    "old": "    journal.toggleClass(b.el, 'glossary', true);\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M59",
    "guard": "a row of one cell names no term",
    "file": "src/enhance/glossary.ts",
    "old": "      if (cell === undefined || meaning === undefined) continue;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M60",
    "guard": "a row's first cell is marked termcell",
    "file": "src/enhance/glossary.ts",
    "old": "      journal.toggleClass(cell, 'termcell', true);\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M61",
    "guard": "a term cell's white space is squashed before its names are read",
    "file": "src/enhance/glossary.ts",
    "old": "      const raw = squash(cell.textContent);",
    "new": "      const raw = cell.textContent ?? '';",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M62",
    "guard": "a term cell over 48 characters names no term",
    "file": "src/enhance/glossary.ts",
    "old": "      if (raw.length > TERM_CELL_MAX || vocab.glossary.notTerm.test(raw)) continue;",
    "new": "      if (vocab.glossary.notTerm.test(raw)) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M63",
    "guard": "a term cell holds at most 48 characters",
    "file": "src/enhance/glossary.ts",
    "old": "export const TERM_CELL_MAX = 48;",
    "new": "export const TERM_CELL_MAX = 49;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M64",
    "guard": "a not-a-term cell (\"IDs\", \"Codes\") names no term",
    "file": "src/enhance/glossary.ts",
    "old": "      if (raw.length > TERM_CELL_MAX || vocab.glossary.notTerm.test(raw)) continue;",
    "new": "      if (raw.length > TERM_CELL_MAX) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M65",
    "guard": "a name shorter than three characters is no term",
    "file": "src/enhance/glossary.ts",
    "old": "        if (name.length < TERM_NAME_MIN || vocab.id.test(name) || vocab.ruleId.test(name)) continue;",
    "new": "        if (vocab.id.test(name) || vocab.ruleId.test(name)) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M66",
    "guard": "a name has three characters or more",
    "file": "src/enhance/glossary.ts",
    "old": "export const TERM_NAME_MIN = 3;",
    "new": "export const TERM_NAME_MIN = 2;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M67",
    "guard": "a name that is an ID is no term",
    "file": "src/enhance/glossary.ts",
    "old": "        if (name.length < TERM_NAME_MIN || vocab.id.test(name) || vocab.ruleId.test(name)) continue;",
    "new": "        if (name.length < TERM_NAME_MIN || vocab.ruleId.test(name)) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M68",
    "guard": "a name that is a rule ID is no term",
    "file": "src/enhance/glossary.ts",
    "old": "        if (name.length < TERM_NAME_MIN || vocab.id.test(name) || vocab.ruleId.test(name)) continue;",
    "new": "        if (name.length < TERM_NAME_MIN || vocab.id.test(name)) continue;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M69",
    "guard": "a term's target is its row",
    "file": "src/enhance/glossary.ts",
    "old": "terms.define({ name, exact, section, target: row,",
    "new": "terms.define({ name, exact, section, target: cell,",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M70",
    "guard": "a definition keeps the row's qualifier",
    "file": "src/enhance/glossary.ts",
    "old": "def: { qual, cell: meaning, row } });",
    "new": "def: { qual: '', cell: meaning, row } });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M71",
    "guard": "a definition's cell is the meaning",
    "file": "src/enhance/glossary.ts",
    "old": "def: { qual, cell: meaning, row } });",
    "new": "def: { qual, cell, row } });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M72",
    "guard": "a term keeps its glossary's section",
    "file": "src/enhance/glossary.ts",
    "old": "terms.define({ name, exact, section, target: row,",
    "new": "terms.define({ name, exact, section: '', target: row,",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M73",
    "guard": "a term keeps whether it is exact",
    "file": "src/enhance/glossary.ts",
    "old": "terms.define({ name, exact, section, target: row,",
    "new": "terms.define({ name, exact: false, section, target: row,",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M74",
    "guard": "\"Name (x)\": x is an alias",
    "file": "src/enhance/glossary.ts",
    "old": "    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });",
    "new": "    if (false) names.push({ name: x, exact: false });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M75",
    "guard": "an alias is one word",
    "file": "src/enhance/glossary.ts",
    "old": "    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });",
    "new": "    if (!vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M76",
    "guard": "an alias stop word qualifies, it is no alias",
    "file": "src/enhance/glossary.ts",
    "old": "    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });",
    "new": "    if (ALIAS.test(x)) names.push({ name: x, exact: false });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M77",
    "guard": "what is not an alias qualifies the definition",
    "file": "src/enhance/glossary.ts",
    "old": "    else qual = x;",
    "new": "    else qual = '';",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M78",
    "guard": "\"Name (x)\" names Name",
    "file": "src/enhance/glossary.ts",
    "old": "  const base = pm === null ? raw : (pm[1] ?? '');",
    "new": "  const base = raw;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M79",
    "guard": "an empty part between joins is dropped",
    "file": "src/enhance/glossary.ts",
    "old": ".filter((x) => x !== '')",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M80",
    "guard": "a cell of one part is one name, not exact",
    "file": "src/enhance/glossary.ts",
    "old": "  if (parts.length > 1 && parts.every((x) => words(x) <= 3))",
    "new": "  if (parts.every((x) => words(x) <= 3))",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M81",
    "guard": "a part of four words keeps the cell one name",
    "file": "src/enhance/glossary.ts",
    "old": "parts.every((x) => words(x) <= 3)",
    "new": "parts.every((x) => words(x) <= 4)",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M82",
    "guard": "a cell's exact names are defined last first, as the reference does",
    "file": "src/enhance/glossary.ts",
    "old": "for (const x of parts) names.unshift({ name: x, exact: true });",
    "new": "for (const x of parts) names.push({ name: x, exact: true });",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M83",
    "guard": "a heading's words leave out its section number",
    "file": "src/enhance/glossary.ts",
    "old": "  return headingText(h, isButton).replace(SEC_NO, '');",
    "new": "  return headingText(h, isButton);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M84",
    "guard": "a heading's words leave out the layout's buttons",
    "file": "src/enhance/glossary.ts",
    "old": "const isButton = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR);",
    "new": "const isButton = (el: Element): boolean => false;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M85",
    "guard": "a section heading has an id",
    "file": "src/enhance/glossary.ts",
    "old": "  if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p;",
    "new": "  if (p.localName === 'h2' || p.localName === 'h3') return p;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M86",
    "guard": "an h2 is a section heading",
    "file": "src/enhance/glossary.ts",
    "old": "  if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p;",
    "new": "  if (p.localName === 'h3' && p.id !== '') return p;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M87",
    "guard": "an h3 is a section heading",
    "file": "src/enhance/glossary.ts",
    "old": "  if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p;",
    "new": "  if (p.localName === 'h2' && p.id !== '') return p;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M88",
    "guard": "an In short box's heading is a section",
    "file": "src/enhance/glossary.ts",
    "old": "  if (p.classList.contains('short') || p.classList.contains('callout')) return p.querySelector('h2, h3');",
    "new": "  if (p.classList.contains('callout')) return p.querySelector('h2, h3');",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M89",
    "guard": "a Where things stand box's heading is a section",
    "file": "src/enhance/glossary.ts",
    "old": "  if (p.classList.contains('short') || p.classList.contains('callout')) return p.querySelector('h2, h3');",
    "new": "  if (p.classList.contains('short')) return p.querySelector('h2, h3');",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M90",
    "guard": "a nested table's section is found above it",
    "file": "src/enhance/glossary.ts",
    "old": "        n = n.parentElement;",
    "new": "        n = null;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M91",
    "guard": "the section is looked for inside the root only",
    "file": "src/enhance/glossary.ts",
    "old": "    for (let n: Element | null = node; n !== null && n !== root; ) {",
    "new": "    for (let n: Element | null = node; n !== null; ) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  }
]
```

## The glossary, its links: `src/enhance/glossary.ts` (L2-T13-M92 to L2-T13-M116)

The first mention per section, the search, the link and its href, and the click that goes to the definition.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M92 | a term link's href is its section heading's id, escaped | `src/enhance/glossary.ts` | `  const hrefOf = (h: Element \| null): string => `#${encodeURIComponent(h?.id ?? '')}`;` → `  const hrefOf = (h: Element \| null): string => `#${h?.id ?? ''}`;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a table nested in a list item finds its section above the list; a heading id is escaped in the href" |
| L2-T13-M93 | a term link's href names its section heading | `src/enhance/glossary.ts` | `  const hrefOf = (h: Element \| null): string => `#${encodeURIComponent(h?.id ?? '')}`;` → `  const hrefOf = (h: Element \| null): string => '#';` | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id"; "a table nested in a list item finds its section above the list; a heading id is escaped in the href"; "a term link is chrome around the source text: a.term, data-term, aria-haspopup="dialog", aria-expanded="false", href to the glossary's heading"; "terms defined before the glossary builds (seeded) are linked too, their href the heading before their target" |
| L2-T13-M94 | a seeded term's href is found from its target | `src/enhance/glossary.ts` | `    if (href === undefined) hrefs.set(entry.target, (href = hrefOf(sectionOf(entry.target))));` → `    href ??= '#';` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "terms defined before the glossary builds (seeded) are linked too, their href the heading before their target" |
| L2-T13-M95 | with no term, no text is read | `src/enhance/glossary.ts` | `  if (all.length === 0) return; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "with no term, the glossary reads no text" |
| L2-T13-M96 | the glossaries hold no mention | `src/enhance/glossary.ts` | `skipsMarkup(el, page) \|\| el.classList.contains('glossary');` → `skipsMarkup(el, page);` | `test/enhance-links.test.ts` (all but RF3): 17 failed \| 32 passed \| 1 skipped (50). "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "a comment node in a block is passed over, and the text around it is read"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id"; "in hand-written html, a glossary row with one cell names no term" and 12 more |
| L2-T13-M97 | an h2 starts a new section | `src/enhance/glossary.ts` | `    if (top.localName === 'h2' \|\| top.classList.contains('short')) used = new Set();` → `    if (top.classList.contains('short')) used = new Set();` | `test/enhance-links.test.ts` (all but RF3): 8 failed \| 41 passed \| 1 skipped (50). "links the first mention per section; an h2 starts a new one, and so does the In short box"; "a term link is chrome around the source text: a.term, data-term, aria-haspopup="dialog", aria-expanded="false", href to the glossary's heading"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "skips a rule head, a step number and a button, and hidden text"; "terms defined before the glossary builds (seeded) are linked too, their href the heading before their target" and 3 more |
| L2-T13-M98 | the In short box starts a new section | `src/enhance/glossary.ts` | `    if (top.localName === 'h2' \|\| top.classList.contains('short')) used = new Set();` → `    if (top.localName === 'h2') used = new Set();` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a mention before the In short box is in a section of its own: the box starts the next one" |
| L2-T13-M99 | a match no term is spelled as is left | `src/enhance/glossary.ts` | `          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {` → `          if (!used.has(entry as TermEntry) && !((entry as TermEntry).exact && said !== (entry as Te…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a mention the pattern finds but no term is spelled as is left: the micro sign and mu fold together only in a pattern" |
| L2-T13-M100 | a term already linked in the section is left | `src/enhance/glossary.ts` | `          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {` → `          if (entry !== undefined && !(entry.exact && said !== entry.name)) {` | `test/enhance-links.test.ts` (all but RF3): 5 failed \| 44 passed \| 1 skipped (50). "links the first mention per section; an h2 starts a new one, and so does the In short box"; "the first mention is the first in document order: across the texts of one block, and across the items of one list"; "the search goes on after the whole of a mention it leaves, so a shorter term inside it is not linked there"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "a term with no heading before its target, in the root, has the empty fragment for its href" |
| L2-T13-M101 | an exact term spelled otherwise is left | `src/enhance/glossary.ts` | `          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {` → `          if (entry !== undefined && !used.has(entry)) {` | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name"; "links the first mention per section; an h2 starts a new one, and so does the In short box"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact" |
| L2-T13-M102 | the search goes on after the whole of a mention it leaves | `src/enhance/glossary.ts` | `for (let at = find(s, 0); at !== null; at = find(s, at.end)) {` → `for (let at = find(s, 0); at !== null; at = find(s, at.start + 1)) {` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "the search goes on after the whole of a mention it leaves, so a shorter term inside it is not linked there" |
| L2-T13-M103 | a linked term is remembered for its section | `src/enhance/glossary.ts` | `        used.add(hit.entry); ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 5 failed \| 44 passed \| 1 skipped (50). "links the first mention per section; an h2 starts a new one, and so does the In short box"; "the first mention is the first in document order: across the texts of one block, and across the items of one list"; "the search goes on after the whole of a mention it leaves, so a shorter term inside it is not linked there"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "a term with no heading before its target, in the root, has the empty fragment for its href" |
| L2-T13-M104 | a link holds the plural ending | `src/enhance/glossary.ts` | `hit.at.end - hit.at.start` → `hit.at.keyEnd - hit.at.start` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "links the first mention per section; an h2 starts a new one, and so does the In short box"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact" |
| L2-T13-M105 | a term link is an a.term | `src/enhance/glossary.ts` | `      className: 'term',` → `      className: 'terms',` | `test/enhance-links.test.ts` (all but RF3): 26 failed \| 23 passed \| 1 skipped (50). "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "a comment node in a block is passed over, and the text around it is read"; "xrefs and the glossary find the root's blocks by walking its children, never through its live children list"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" and 21 more |
| L2-T13-M106 | a term link names its term (data-term) | `src/enhance/glossary.ts` | `'data-term': entry.key, ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a term link is chrome around the source text: a.term, data-term, aria-haspopup="dialog", aria-expanded="false", href to the glossary's heading" |
| L2-T13-M107 | a term link says it opens a dialog (aria-haspopup) | `src/enhance/glossary.ts` | `'aria-haspopup': 'dialog', 'aria-expanded': 'false' }` → `'aria-expanded': 'false' }` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a term link is chrome around the source text: a.term, data-term, aria-haspopup="dialog", aria-expanded="false", href to the glossary's heading" |
| L2-T13-M108 | a term link says it is closed (aria-expanded) | `src/enhance/glossary.ts` | `'aria-haspopup': 'dialog', 'aria-expanded': 'false' }` → `'aria-haspopup': 'dialog' }` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a term link is chrome around the source text: a.term, data-term, aria-haspopup="dialog", aria-expanded="false", href to the glossary's heading" |
| L2-T13-M109 | a plain click goes to the term's row | `src/enhance/glossary.ts` | `      e.preventDefault(); ⏎       ctx.nav.goTo(entry.target, { push: true }); ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a plain click goes to the term's row (focused), not the heading its href names; the host hears no id" |
| L2-T13-M110 | a plain click is taken from nav's own handler | `src/enhance/glossary.ts` | `      e.preventDefault(); ⏎       ctx.nav.goTo` → `      ctx.nav.goTo` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a plain click goes to the term's row (focused), not the heading its href names; the host hears no id" |
| L2-T13-M111 | a click a handler already took is left alone | `src/enhance/glossary.ts` | `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) …` → `      if (e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a modified click, another button, or a click a handler already took, is left alone" |
| L2-T13-M112 | another button is left alone | `src/enhance/glossary.ts` | `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) …` → `      if (e.defaultPrevented \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a modified click, another button, or a click a handler already took, is left alone" |
| L2-T13-M113 | a click with Ctrl is left alone | `src/enhance/glossary.ts` | `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) …` → `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) return;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a modified click, another button, or a click a handler already took, is left alone" |
| L2-T13-M114 | a click with Cmd is left alone | `src/enhance/glossary.ts` | `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) …` → `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.shiftKey \|\| e.altKey) return;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a modified click, another button, or a click a handler already took, is left alone" |
| L2-T13-M115 | a click with Shift is left alone | `src/enhance/glossary.ts` | `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) …` → `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.altKey) return;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a modified click, another button, or a click a handler already took, is left alone" |
| L2-T13-M116 | a click with Alt is left alone | `src/enhance/glossary.ts` | `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey) …` → `      if (e.defaultPrevented \|\| e.button !== 0 \|\| e.ctrlKey \|\| e.metaKey \|\| e.shiftKey) return;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a modified click, another button, or a click a handler already took, is left alone" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M92",
    "guard": "a term link's href is its section heading's id, escaped",
    "file": "src/enhance/glossary.ts",
    "old": "  const hrefOf = (h: Element | null): string => `#${encodeURIComponent(h?.id ?? '')}`;",
    "new": "  const hrefOf = (h: Element | null): string => `#${h?.id ?? ''}`;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M93",
    "guard": "a term link's href names its section heading",
    "file": "src/enhance/glossary.ts",
    "old": "  const hrefOf = (h: Element | null): string => `#${encodeURIComponent(h?.id ?? '')}`;",
    "new": "  const hrefOf = (h: Element | null): string => '#';",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M94",
    "guard": "a seeded term's href is found from its target",
    "file": "src/enhance/glossary.ts",
    "old": "    if (href === undefined) hrefs.set(entry.target, (href = hrefOf(sectionOf(entry.target))));",
    "new": "    href ??= '#';",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M95",
    "guard": "with no term, no text is read",
    "file": "src/enhance/glossary.ts",
    "old": "  if (all.length === 0) return;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M96",
    "guard": "the glossaries hold no mention",
    "file": "src/enhance/glossary.ts",
    "old": "skipsMarkup(el, page) || el.classList.contains('glossary');",
    "new": "skipsMarkup(el, page);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M97",
    "guard": "an h2 starts a new section",
    "file": "src/enhance/glossary.ts",
    "old": "    if (top.localName === 'h2' || top.classList.contains('short')) used = new Set();",
    "new": "    if (top.classList.contains('short')) used = new Set();",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M98",
    "guard": "the In short box starts a new section",
    "file": "src/enhance/glossary.ts",
    "old": "    if (top.localName === 'h2' || top.classList.contains('short')) used = new Set();",
    "new": "    if (top.localName === 'h2') used = new Set();",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M99",
    "guard": "a match no term is spelled as is left",
    "file": "src/enhance/glossary.ts",
    "old": "          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {",
    "new": "          if (!used.has(entry as TermEntry) && !((entry as TermEntry).exact && said !== (entry as TermEntry).name)) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M100",
    "guard": "a term already linked in the section is left",
    "file": "src/enhance/glossary.ts",
    "old": "          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {",
    "new": "          if (entry !== undefined && !(entry.exact && said !== entry.name)) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M101",
    "guard": "an exact term spelled otherwise is left",
    "file": "src/enhance/glossary.ts",
    "old": "          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {",
    "new": "          if (entry !== undefined && !used.has(entry)) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M102",
    "guard": "the search goes on after the whole of a mention it leaves",
    "file": "src/enhance/glossary.ts",
    "old": "for (let at = find(s, 0); at !== null; at = find(s, at.end)) {",
    "new": "for (let at = find(s, 0); at !== null; at = find(s, at.start + 1)) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M103",
    "guard": "a linked term is remembered for its section",
    "file": "src/enhance/glossary.ts",
    "old": "        used.add(hit.entry);\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M104",
    "guard": "a link holds the plural ending",
    "file": "src/enhance/glossary.ts",
    "old": "hit.at.end - hit.at.start",
    "new": "hit.at.keyEnd - hit.at.start",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M105",
    "guard": "a term link is an a.term",
    "file": "src/enhance/glossary.ts",
    "old": "      className: 'term',",
    "new": "      className: 'terms',",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M106",
    "guard": "a term link names its term (data-term)",
    "file": "src/enhance/glossary.ts",
    "old": "'data-term': entry.key, ",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M107",
    "guard": "a term link says it opens a dialog (aria-haspopup)",
    "file": "src/enhance/glossary.ts",
    "old": "'aria-haspopup': 'dialog', 'aria-expanded': 'false' }",
    "new": "'aria-expanded': 'false' }",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M108",
    "guard": "a term link says it is closed (aria-expanded)",
    "file": "src/enhance/glossary.ts",
    "old": "'aria-haspopup': 'dialog', 'aria-expanded': 'false' }",
    "new": "'aria-haspopup': 'dialog' }",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M109",
    "guard": "a plain click goes to the term's row",
    "file": "src/enhance/glossary.ts",
    "old": "      e.preventDefault();\n      ctx.nav.goTo(entry.target, { push: true });\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M110",
    "guard": "a plain click is taken from nav's own handler",
    "file": "src/enhance/glossary.ts",
    "old": "      e.preventDefault();\n      ctx.nav.goTo",
    "new": "      ctx.nav.goTo",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M111",
    "guard": "a click a handler already took is left alone",
    "file": "src/enhance/glossary.ts",
    "old": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M112",
    "guard": "another button is left alone",
    "file": "src/enhance/glossary.ts",
    "old": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M113",
    "guard": "a click with Ctrl is left alone",
    "file": "src/enhance/glossary.ts",
    "old": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.shiftKey || e.altKey) return;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M114",
    "guard": "a click with Cmd is left alone",
    "file": "src/enhance/glossary.ts",
    "old": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey) return;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M115",
    "guard": "a click with Shift is left alone",
    "file": "src/enhance/glossary.ts",
    "old": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M116",
    "guard": "a click with Alt is left alone",
    "file": "src/enhance/glossary.ts",
    "old": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;",
    "new": "      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  }
]
```

## The term matcher: `src/enhance/glossary.ts` (L2-T13-M117 to L2-T13-M148)

The trie and its walk, white space, word edges, case, and the plural endings, held to the reference's pattern on random texts and on every code unit.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M117 | a key ends a term in the trie | `src/enhance/glossary.ts` | `    node.end = true; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 29 failed \| 20 passed \| 1 skipped (50). "the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)"; "a comment node in a block is passed over, and the text around it is read"; "xrefs and the glossary find the root's blocks by walking its children, never through its live children list"; "a two-column table headed like Term \| Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not"; "a table's section: the first heading of an In short or Where things stand box before it, and never a heading without an id" and 24 more |
| L2-T13-M118 | a key's space is the edge for a run of white space | `src/enhance/glossary.ts` | `      const edge = isSpace(c) ? SPACE : canon(c);` → `      const edge = canon(c);` | `test/enhance-links.test.ts` (all but RF3): 8 failed \| 41 passed \| 1 skipped (50). "in hand-written html, a term cell is read as its words: white space at its ends and line breaks inside count as one space"; "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name"; "links the first mention per section; an h2 starts a new one, and so does the In short box"; "the search goes on after the whole of a mention it leaves, so a shorter term inside it is not linked there"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact" and 3 more |
| L2-T13-M119 | a mention starts at a word edge | `src/enhance/glossary.ts` | `      if (isWordOrDash(text.charCodeAt(p - 1))) continue; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M120 | a run of white space in the text is one edge | `src/enhance/glossary.ts` | `          while (isSpace(text.charCodeAt(j))) j += 1; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact" |
| L2-T13-M121 | the longest term at a place is tried first | `src/enhance/glossary.ts` | `      for (let k = ends.length - 1; k >= 0; k -= 1) {` → `      for (let k = 0; k < ends.length; k += 1) {` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start"; "a longer term wins at the same place, and a shorter one is tried when the longer one's end is inside a word" |
| L2-T13-M122 | a shorter term is tried when the longer one fails | `src/enhance/glossary.ts` | `        if (node?.end === true) ends.push(j);` → `        if (node?.end === true) ends.splice(0, ends.length, j);` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "a longer term wins at the same place, and a shorter one is tried when the longer one's end is inside a word" |
| L2-T13-M123 | a plural in s | `src/enhance/glossary.ts` | `  if (canon(text.charCodeAt(at)) === S && free(at + 1)) return at + 1; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case"; "a longer term wins at the same place, and a shorter one is tried when the longer one's end is inside a word" |
| L2-T13-M124 | a plural in es | `src/enhance/glossary.ts` | `  if (canon(text.charCodeAt(at)) === E && canon(text.charCodeAt(at + 1)) === S && free(at + 2)) retu…` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "links the first mention per section; an h2 starts a new one, and so does the In short box"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start" |
| L2-T13-M125 | no letter follows a plural in s | `src/enhance/glossary.ts` | `=== S && free(at + 1)) return at + 1;` → `=== S) return at + 1;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start" |
| L2-T13-M126 | no letter follows a plural in es | `src/enhance/glossary.ts` | `=== S && free(at + 2)) return at + 2;` → `=== S) return at + 2;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start" |
| L2-T13-M127 | no letter follows a bare mention | `src/enhance/glossary.ts` | `  return free(at) ? at : -1;` → `  return at;` | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case"; "a longer term wins at the same place, and a shorter one is tried when the longer one's end is inside a word" |
| L2-T13-M128 | a free edge is no letter, digit, _ or - | `src/enhance/glossary.ts` | `  const free = (i: number): boolean => !isWordOrDash(text.charCodeAt(i));` → `  const free = (i: number): boolean => i >= 0;` | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case"; "a longer term wins at the same place, and a shorter one is tried when the longer one's end is inside a word" |
| L2-T13-M129 | case: an ASCII letter folds to its capital | `src/enhance/glossary.ts` | `  if (c < 128) return c >= 97 && c <= 122 ? c - 32 : c;` → `  if (c < 128) return c;` | `test/enhance-links.test.ts` (all but RF3): 6 failed \| 43 passed \| 1 skipped (50). "a cell of several names keeps each name exact; a part of four words or more keeps the cell one name"; "links the first mention per section; an h2 starts a new one, and so does the In short box"; "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" and 1 more |
| L2-T13-M130 | case: a letter whose capital is two units stays itself | `src/enhance/glossary.ts` | `  if (u.length !== 1) return c; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M131 | case: no letter outside ASCII folds into ASCII | `src/enhance/glossary.ts` | `  return cu < 128 ? c : cu;` → `  return cu;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M132 | case: a letter outside ASCII folds to its capital | `src/enhance/glossary.ts` | `  return cu < 128 ? c : cu;` → `  return cu < 128 ? c : c;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M133 | white space: a space | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\| ⏎     c ===…` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M134 | white space: a tab, a line end and the other controls of \s | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\| ⏎     c === 0x2028 \|\| …` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M135 | white space: a no-break space | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\| ⏎     c === 0…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M136 | white space: the Ogham space | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| (c >= 0x2000 && c <= 0x200a) \|\| ⏎     c === 0x2…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M137 | white space: the typographic spaces | `src/enhance/glossary.ts` | `(c >= 0x2000 && c <= 0x200a) \|\|` → `false \|\|` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M138 | white space: the line separator | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M139 | white space: the paragraph separator | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M140 | white space: the narrow no-break space | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M141 | white space: the mathematical space | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M142 | white space: the ideographic space | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M143 | white space: the byte order mark | `src/enhance/glossary.ts` | `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` → `    c === 32 \|\| (c >= 9 && c <= 13) \|\| c === 0xa0 \|\| c === 0x1680 \|\| (c >= 0x2000 && c <= 0x200a) \|\|…` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 48 passed \| 1 skipped (50). "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M144 | a word edge: a digit is part of a word | `src/enhance/glossary.ts` | `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === …` → `  return (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === 45;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M145 | a word edge: a capital is part of a word | `src/enhance/glossary.ts` | `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === …` → `  return (c >= 48 && c <= 57) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === 45;` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 47 passed \| 1 skipped (50). "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M146 | a word edge: a small letter is part of a word | `src/enhance/glossary.ts` | `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === …` → `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| c === 95 \|\| c === 45;` | `test/enhance-links.test.ts` (all but RF3): 4 failed \| 45 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case"; "a longer term wins at the same place, and a shorter one is tried when the longer one's end is inside a word" |
| L2-T13-M147 | a word edge: an underscore is part of a word | `src/enhance/glossary.ts` | `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === …` → `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 45;` | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |
| L2-T13-M148 | a word edge: a dash is part of a word | `src/enhance/glossary.ts` | `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === …` → `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95;` | `test/enhance-links.test.ts` (all but RF3): 3 failed \| 46 passed \| 1 skipped (50). "plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact"; "finds what the reference's pattern finds, on random keys and texts, from any start"; "reads every code unit as the language's pattern does: white space, the edges of a word, and case" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M117",
    "guard": "a key ends a term in the trie",
    "file": "src/enhance/glossary.ts",
    "old": "    node.end = true;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M118",
    "guard": "a key's space is the edge for a run of white space",
    "file": "src/enhance/glossary.ts",
    "old": "      const edge = isSpace(c) ? SPACE : canon(c);",
    "new": "      const edge = canon(c);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M119",
    "guard": "a mention starts at a word edge",
    "file": "src/enhance/glossary.ts",
    "old": "      if (isWordOrDash(text.charCodeAt(p - 1))) continue;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M120",
    "guard": "a run of white space in the text is one edge",
    "file": "src/enhance/glossary.ts",
    "old": "          while (isSpace(text.charCodeAt(j))) j += 1;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M121",
    "guard": "the longest term at a place is tried first",
    "file": "src/enhance/glossary.ts",
    "old": "      for (let k = ends.length - 1; k >= 0; k -= 1) {",
    "new": "      for (let k = 0; k < ends.length; k += 1) {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M122",
    "guard": "a shorter term is tried when the longer one fails",
    "file": "src/enhance/glossary.ts",
    "old": "        if (node?.end === true) ends.push(j);",
    "new": "        if (node?.end === true) ends.splice(0, ends.length, j);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M123",
    "guard": "a plural in s",
    "file": "src/enhance/glossary.ts",
    "old": "  if (canon(text.charCodeAt(at)) === S && free(at + 1)) return at + 1;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M124",
    "guard": "a plural in es",
    "file": "src/enhance/glossary.ts",
    "old": "  if (canon(text.charCodeAt(at)) === E && canon(text.charCodeAt(at + 1)) === S && free(at + 2)) return at + 2;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M125",
    "guard": "no letter follows a plural in s",
    "file": "src/enhance/glossary.ts",
    "old": "=== S && free(at + 1)) return at + 1;",
    "new": "=== S) return at + 1;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M126",
    "guard": "no letter follows a plural in es",
    "file": "src/enhance/glossary.ts",
    "old": "=== S && free(at + 2)) return at + 2;",
    "new": "=== S) return at + 2;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M127",
    "guard": "no letter follows a bare mention",
    "file": "src/enhance/glossary.ts",
    "old": "  return free(at) ? at : -1;",
    "new": "  return at;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M128",
    "guard": "a free edge is no letter, digit, _ or -",
    "file": "src/enhance/glossary.ts",
    "old": "  const free = (i: number): boolean => !isWordOrDash(text.charCodeAt(i));",
    "new": "  const free = (i: number): boolean => i >= 0;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M129",
    "guard": "case: an ASCII letter folds to its capital",
    "file": "src/enhance/glossary.ts",
    "old": "  if (c < 128) return c >= 97 && c <= 122 ? c - 32 : c;",
    "new": "  if (c < 128) return c;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M130",
    "guard": "case: a letter whose capital is two units stays itself",
    "file": "src/enhance/glossary.ts",
    "old": "  if (u.length !== 1) return c;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M131",
    "guard": "case: no letter outside ASCII folds into ASCII",
    "file": "src/enhance/glossary.ts",
    "old": "  return cu < 128 ? c : cu;",
    "new": "  return cu;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M132",
    "guard": "case: a letter outside ASCII folds to its capital",
    "file": "src/enhance/glossary.ts",
    "old": "  return cu < 128 ? c : cu;",
    "new": "  return cu < 128 ? c : c;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M133",
    "guard": "white space: a space",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M134",
    "guard": "white space: a tab, a line end and the other controls of \\s",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M135",
    "guard": "white space: a no-break space",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M136",
    "guard": "white space: the Ogham space",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M137",
    "guard": "white space: the typographic spaces",
    "file": "src/enhance/glossary.ts",
    "old": "(c >= 0x2000 && c <= 0x200a) ||",
    "new": "false ||",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M138",
    "guard": "white space: the line separator",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M139",
    "guard": "white space: the paragraph separator",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M140",
    "guard": "white space: the narrow no-break space",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M141",
    "guard": "white space: the mathematical space",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x3000 || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M142",
    "guard": "white space: the ideographic space",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0xfeff",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M143",
    "guard": "white space: the byte order mark",
    "file": "src/enhance/glossary.ts",
    "old": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff",
    "new": "    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||\n    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M144",
    "guard": "a word edge: a digit is part of a word",
    "file": "src/enhance/glossary.ts",
    "old": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "new": "  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M145",
    "guard": "a word edge: a capital is part of a word",
    "file": "src/enhance/glossary.ts",
    "old": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "new": "  return (c >= 48 && c <= 57) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M146",
    "guard": "a word edge: a small letter is part of a word",
    "file": "src/enhance/glossary.ts",
    "old": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "new": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || c === 95 || c === 45;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M147",
    "guard": "a word edge: an underscore is part of a word",
    "file": "src/enhance/glossary.ts",
    "old": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "new": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M148",
    "guard": "a word edge: a dash is part of a word",
    "file": "src/enhance/glossary.ts",
    "old": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "new": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  }
]
```

## RF3 and the Level 2 cases (L2-T13-M149 to L2-T13-M152)

The large plan's bound, with the matcher rebuilt for every text (its cost then grows with the terms as well as the text), and three rows measured on the Level 2 cases in Chromium.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M149 | the matcher is built once, so a text's cost does not grow with the number of terms (RF3) | `src/enhance/glossary.ts` | `        const s: string = rest.data;` → `        const s: string = rest.data; ⏎         const find = termMatcher(all.map((t) => t.key));` | `test/enhance-links.test.ts` (RF3 only): 1 failed \| 54 skipped (55). "xrefs and the glossary stay within their budget on the large plan, and a plan twice as large takes at most 2.5 times as long". Red by the budget: the large plan 21,987 and 52,166 ms, then 125,521 and 151,107 ms; pairs 5.71 and 2.90 (median 4.31), two rounds before the cap. |
| L2-T13-M150 | a plural in es (Level 2: links/plurals) | `src/enhance/glossary.ts` | `  if (canon(text.charCodeAt(at)) === E && canon(text.charCodeAt(at + 1)) === S && free(at + 2)) retu…` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 15 passed \| 11 skipped (27). "links/plurals" |
| L2-T13-M151 | an h2 starts a new section (Level 2: links/first-mention) | `src/enhance/glossary.ts` | `    if (top.localName === 'h2' \|\| top.classList.contains('short')) used = new Set();` → `    if (top.classList.contains('short')) used = new Set();` | `test/browser/layout-corpus.test.ts`: 2 failed \| 14 passed \| 11 skipped (27). "links/first-mention"; "links/plurals" |
| L2-T13-M152 | a word edge: an underscore is part of a word (Level 2: links/plurals) | `src/enhance/glossary.ts` | `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 95 \|\| c === …` → `  return (c >= 48 && c <= 57) \|\| (c >= 65 && c <= 90) \|\| (c >= 97 && c <= 122) \|\| c === 45;` | `test/browser/layout-corpus.test.ts`: 1 failed \| 15 passed \| 11 skipped (27). "links/plurals" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M149",
    "guard": "the matcher is built once, so a text's cost does not grow with the number of terms (RF3)",
    "file": "src/enhance/glossary.ts",
    "old": "        const s: string = rest.data;",
    "new": "        const s: string = rest.data;\n        const find = termMatcher(all.map((t) => t.key));",
    "tests": "test/enhance-links.test.ts -t 'RF3'"
  },
  {
    "id": "L2-T13-M150",
    "guard": "a plural in es (Level 2: links/plurals)",
    "file": "src/enhance/glossary.ts",
    "old": "  if (canon(text.charCodeAt(at)) === E && canon(text.charCodeAt(at + 1)) === S && free(at + 2)) return at + 2;\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T13-M151",
    "guard": "an h2 starts a new section (Level 2: links/first-mention)",
    "file": "src/enhance/glossary.ts",
    "old": "    if (top.localName === 'h2' || top.classList.contains('short')) used = new Set();",
    "new": "    if (top.classList.contains('short')) used = new Set();",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T13-M152",
    "guard": "a word edge: an underscore is part of a word (Level 2: links/plurals)",
    "file": "src/enhance/glossary.ts",
    "old": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;",
    "new": "  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45;",
    "tests": "test/browser/layout-corpus.test.ts"
  }
]
```

## The review's fixes (L2-T13-M153 to L2-T13-M164)

Rows the review found missing: the journal's split, wrap, class and listener (the guard "destroy restores every text node", and a detached link's own click), the two linear-cost fixes and the finder's remembered answer, the seams test's pinned exports of a filled module, and the id nav tells the host for a target with a document id of its own (a row on `nav.ts`, Task 7b's file, measured in a throwaway copy only, to show the new case bites).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T13-M153 | the term link's click listener goes through the journal, so destroy removes it | `src/enhance/glossary.ts` | `    journal.listen(a, 'click', (event) => {` → `    a.addEventListener('click', (event) => {` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "after destroy a click does nothing: the link's own listener is gone with it" |
| L2-T13-M154 | the split before a mention goes through the journal, so destroy joins the text again | `src/enhance/mentions.ts` | `  const mid = at > 0 ? journal.split(text, at) : text;` → `  const mid = at > 0 ? text.splitText(at) : text;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "destroy restores every text node, byte for byte" |
| L2-T13-M155 | the split after a mention goes through the journal, so destroy joins the text again | `src/enhance/mentions.ts` | `  const after = length < mid.data.length ? journal.split(mid, length) : null;` → `  const after = length < mid.data.length ? mid.splitText(length) : null;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "destroy restores every text node, byte for byte" |
| L2-T13-M156 | the link wraps the mention through the journal, so destroy unwraps it | `src/enhance/mentions.ts` | `  journal.wrap([mid], link);` → `  mid.parentNode?.insertBefore(link, mid); ⏎   link.appendChild(mid);` | `test/enhance-links.test.ts` (all but RF3): 2 failed \| 52 passed \| 1 skipped (55). "after destroy a click does nothing: the link's own listener is gone with it"; "destroy restores every text node, byte for byte" |
| L2-T13-M157 | the glossary class goes on through the journal, so destroy takes it off | `src/enhance/glossary.ts` | `    journal.toggleClass(b.el, 'glossary', true);` → `    b.el.classList.add('glossary');` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "destroy restores every text node, byte for byte" |
| L2-T13-M158 | the termcell class goes on through the journal, so destroy takes it off | `src/enhance/glossary.ts` | `      journal.toggleClass(cell, 'termcell', true);` → `      cell.classList.add('termcell');` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "destroy restores every text node, byte for byte" |
| L2-T13-M159 | the matcher stops at a run of white space no term goes on through, before skipping it | `src/enhance/glossary.ts` | `          if (node === undefined) break; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a run of white space is read a bounded number of times: the cost grows with the text, never with its square" |
| L2-T13-M160 | the section finder remembers each element it passed, so each element is read once | `src/enhance/glossary.ts` | `    for (const n of passed) known.set(n, found); ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "each table's section is found in one pass: the siblings read grow with the number of tables, never its square" |
| L2-T13-M161 | an element the finder already passed answers its remembered heading | `src/enhance/glossary.ts` | `        found = known.get(n) ?? null;` → `        found = null;` | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "tables under one heading share its answer: a second table in a glossary section is a glossary too, its href that heading" |
| L2-T13-M162 | a filled module's exports are pinned: a new export in the glossary is red | `src/enhance/glossary.ts` | `function sectionAt(p: Element)` → `export function sectionAt(p: Element)` | `test/enhance-seams.test.ts`: 1 failed \| 95 passed (96). "every module of src/enhance that exports build is registered, under its file name, and every stub exports build (and after when it waits on the host)" |
| L2-T13-M163 | a filled module's exports are pinned: a new export in xrefs is red | `src/enhance/xrefs.ts` | `export const QUAL_WINDOW = 24;` → `export const QUAL_WINDOW = 24; ⏎ export const QUAL_EXTRA = 0;` | `test/enhance-seams.test.ts`: 1 failed \| 95 passed (96). "every module of src/enhance that exports build is registered, under its file name, and every stub exports build (and after when it waits on the host)" |
| L2-T13-M164 | a cross-reference to a target with its own document id tells the host that id (nav's idOf, LD7) | `src/enhance/nav.ts` | `    if (el.id !== '' && ids.get(el.id) === el) return el.id; ⏎ ` → (deleted) | `test/enhance-links.test.ts` (all but RF3): 1 failed \| 53 passed \| 1 skipped (55). "a click on a cross-reference to a target with its own document id tells the host that id, as nav names it" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T13-M153",
    "guard": "the term link's click listener goes through the journal, so destroy removes it",
    "file": "src/enhance/glossary.ts",
    "old": "    journal.listen(a, 'click', (event) => {",
    "new": "    a.addEventListener('click', (event) => {",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M154",
    "guard": "the split before a mention goes through the journal, so destroy joins the text again",
    "file": "src/enhance/mentions.ts",
    "old": "  const mid = at > 0 ? journal.split(text, at) : text;",
    "new": "  const mid = at > 0 ? text.splitText(at) : text;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M155",
    "guard": "the split after a mention goes through the journal, so destroy joins the text again",
    "file": "src/enhance/mentions.ts",
    "old": "  const after = length < mid.data.length ? journal.split(mid, length) : null;",
    "new": "  const after = length < mid.data.length ? mid.splitText(length) : null;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M156",
    "guard": "the link wraps the mention through the journal, so destroy unwraps it",
    "file": "src/enhance/mentions.ts",
    "old": "  journal.wrap([mid], link);",
    "new": "  mid.parentNode?.insertBefore(link, mid);\n  link.appendChild(mid);",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M157",
    "guard": "the glossary class goes on through the journal, so destroy takes it off",
    "file": "src/enhance/glossary.ts",
    "old": "    journal.toggleClass(b.el, 'glossary', true);",
    "new": "    b.el.classList.add('glossary');",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M158",
    "guard": "the termcell class goes on through the journal, so destroy takes it off",
    "file": "src/enhance/glossary.ts",
    "old": "      journal.toggleClass(cell, 'termcell', true);",
    "new": "      cell.classList.add('termcell');",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M159",
    "guard": "the matcher stops at a run of white space no term goes on through, before skipping it",
    "file": "src/enhance/glossary.ts",
    "old": "          if (node === undefined) break;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M160",
    "guard": "the section finder remembers each element it passed, so each element is read once",
    "file": "src/enhance/glossary.ts",
    "old": "    for (const n of passed) known.set(n, found);\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M161",
    "guard": "an element the finder already passed answers its remembered heading",
    "file": "src/enhance/glossary.ts",
    "old": "        found = known.get(n) ?? null;",
    "new": "        found = null;",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  },
  {
    "id": "L2-T13-M162",
    "guard": "a filled module's exports are pinned: a new export in the glossary is red",
    "file": "src/enhance/glossary.ts",
    "old": "function sectionAt(p: Element)",
    "new": "export function sectionAt(p: Element)",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T13-M163",
    "guard": "a filled module's exports are pinned: a new export in xrefs is red",
    "file": "src/enhance/xrefs.ts",
    "old": "export const QUAL_WINDOW = 24;",
    "new": "export const QUAL_WINDOW = 24;\nexport const QUAL_EXTRA = 0;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T13-M164",
    "guard": "a cross-reference to a target with its own document id tells the host that id (nav's idOf, LD7)",
    "file": "src/enhance/nav.ts",
    "old": "    if (el.id !== '' && ids.get(el.id) === el) return el.id;\n",
    "new": "",
    "tests": "test/enhance-links.test.ts -t '^(?!RF3)'"
  }
]
```
