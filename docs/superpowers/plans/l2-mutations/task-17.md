# L2 Task 17: mutation rows (preview cards)

Each guard of Task 17, deleted or changed once, with the tests that go red: the module export `show(ctx, trigger)`, the
copies a card is made of and what they keep, the card's link and its status words, what each kind of card shows,
showing, hiding and placing the card, the pointers, focus, taps and keys, the card's own link, its overlay and what
closes it (`src/enhance/cards.ts`); six rows that show the real-browser cases bite (`test/browser/cards.test.ts`); and
three rows that show the new Level 2 case, `cards/xrefs`, holds the cross-references it pins (`src/enhance/xrefs.ts`,
Task 13's code, mutated in the throwaway copy only). Measured 2026-10-20 on branch `l2-t17-cards` at commit
`7368c0f`, every row, L2-T17-M1 to L2-T17-M178. All 178 are red (`rc=1`): 176 there, and two, L2-T17-M58 and
L2-T17-M99, measured again at `c506ca2` (below). The review's fix round added L2-T17-M179 to L2-T17-M196, all red; its own
section at the end says where each was measured and names the five earlier rows whose code it changed.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), with the changes Task 7b's rows file records: a 512 MiB output
buffer, a run that ends with no exit status counted as no verdict (KILLED), and the `Errors`, `Unhandled Rejection` and
`TypeError` lines kept in what it prints. Each row is applied to its own throwaway copy of the working tree (tracked and
untracked files, never ignored ones, `node_modules` linked from the checkout), its tests run there with the local
`vitest`, and the copy is deleted. Each `old` occurs exactly once in its file. The rows ran with
`DOCREADER_BROWSERS=chromium` (C45): the browser and Level 2 rows ran in Chromium, and WebKit was reported as excluded.
They ran in two batches side by side. The checkout was never edited: `git status --porcelain` read the same (empty)
before and after, and so did `HEAD` and the hash of `git diff`. The Red column gives the count line and the failing
tests the run printed (at most five here). The jsdom rows run `test/enhance-cards.test.ts` whole (84 cases); the Level 2
rows run the corpus file with `-t 'cards/xrefs'`.

Notes on the measurement.
- **Two rows were green at first, and each found a case that could not see its guard.** Both cases were made
  stronger in `c506ca2` (tests and comments only), and the two rows were measured again there, red:
  - L2-T17-M58 (a show for the trigger already shown makes no new content): the case compared the card's head before
    and after with `toEqual`, which holds for an equal node made anew. It now holds the node itself (`toBe`).
  - L2-T17-M99 (the pointer back on its trigger calls off a pending hide): the hover that follows also shows the card
    again after its delay, so the card was open again by the time the case looked. The case now looks within the hide's
    delay, before a new show could end, and the trigger's `aria-expanded` with it.
- **What is not a guard here, and has no row.** Some code changes no outcome when removed, so no case could redden it;
  it is named here instead.
  - TypeScript's narrowing: `card === null` beside `shown === null` (a card shows only once it is made), `a === null`
    in `place()` (the scroll listener lives only while a card shows), `first === undefined` (a card always holds its
    link), `goal !== null` (set with `shown`), the `?? entry.title` after a figure's caption (every figure entry has its
    figure), `ref === undefined` before `ctx.index.get`, and `t === null` in `pointerout` (a pointer event's target is an
    element).
  - The literal labels (`Go to <ID> →`, `Go to definition →`, `Definition: <name>`, `<ID> preview`, `Glossary`) are
    pinned by the content and ARIA cases, as text, not as guards.
- **Checks removed before measuring, because no case could redden them** (C49; each was the reference layout's):
  - the instance's `live()` check at the start of a show (the export runs inside `ctx.operate`, and every listener and
    timer runs only while live);
  - the type checks on an event target beyond `null` (an event's target is a node, or the window, which is neither an
    element nor a text);
  - `if (a !== shown)` before a hover's show, a block's click, a tap's show and a block's Enter (a show for the trigger
    already shown only places the card again);
  - the hide before the card's link goes (going there reveals the target, and the reveal hides the card), and
    `hideTimer = null` / `showTimer = null` inside the timers (a spent cancel does nothing);
  - the `button` in the card's Tab stops (a copy keeps no form control, and the card makes none), the initial
    `aria-label` "Preview" (the card is labelled before it is first put in the root), the trigger itself as a place the
    overlay's close gives the focus back from (the focus is there already), and a pill read as empty (a pill the layout
    made always holds its words).
- **The Level 2 rows** mutate `src/enhance/xrefs.ts`, which is Task 13's: they show that the case this task adds (C53's
  carried item: the first mention per block, a mention in its own row, a qualifier) goes red without each guard.

## show(ctx, trigger) and the copies (L2-T17-M1 to L2-T17-M20)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M1 | show() of a context no instance made answers false | `src/enhance/cards.ts` | `  if (state === undefined) return false; ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "show() of a context no instance made answers false" |
| L2-T17-M2 | show() once the instance is not live answers false | `src/enhance/cards.ts` | `return ctx.operate(() => state.show(trigger)) === true;` → `return ctx.operate(() => state.show(trigger)) !== false;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "show() of another root's context never reaches this root, and does nothing once destroyed" |
| L2-T17-M3 | an event with no target (relatedTarget null) is no element | `src/enhance/cards.ts` | `  if (n === null) return null; ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "a pointer that leaves before the delay shows nothing, wherever it goes"; "focus leaving the page (to nothing) hides it"; "after destroy no timer fires: a pending show or hide is cancelled, and does nothing" |
| L2-T17-M4 | an event whose target is a text counts as its parent's | `src/enhance/cards.ts` | `return n.nodeType === 3 ? n.parentElement : null;` → `return null;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "an event whose target is the trigger's text counts as the trigger's" |
| L2-T17-M5 | hidden chrome in the ID cell is passed over | `src/enhance/cards.ts` | `    if (x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute(…` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a hidden bullet in the ID cell is passed over: the cell is still the ID alone" |
| L2-T17-M6 | a copied cross-reference becomes its text | `src/enhance/cards.ts` | `box.querySelectorAll('a.xref, a.term')` → `box.querySelectorAll('a.term')` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a term: its name, its glossary's section, each definition with its qualifier"; "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M7 | a copied term link becomes its text | `src/enhance/cards.ts` | `box.querySelectorAll('a.xref, a.term')` → `box.querySelectorAll('a.xref')` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a clone's term link becomes text too"; "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M8 | a copy keeps no input | `src/enhance/cards.ts` | `'input, button, select, textarea'` → `'button, select, textarea'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M9 | a copy keeps no button | `src/enhance/cards.ts` | `'input, button, select, textarea'` → `'input, select, textarea'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M10 | a copy keeps no select | `src/enhance/cards.ts` | `'input, button, select, textarea'` → `'input, button, textarea'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M11 | a copy keeps no textarea | `src/enhance/cards.ts` | `'input, button, select, textarea'` → `'input, button, select'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M12 | a copy keeps no id | `src/enhance/cards.ts` | `    el.removeAttribute('id'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M13 | a copy keeps no render() line mark | `src/enhance/cards.ts` | `    el.removeAttribute('data-line'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules"" |
| L2-T17-M14 | every copied element is chrome | `src/enhance/cards.ts` | `    el.setAttribute('data-docreader-chrome', ''); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M15 | a term's definitions are scrubbed | `src/enhance/cards.ts` | `  scrub(body); ⏎   const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to definition →'` → `  const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to definition →'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term: its name, its glossary's section, each definition with its qualifier" |
| L2-T17-M16 | an ID's body is scrubbed | `src/enhance/cards.ts` | `  scrub(body); ⏎   const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to` → `  const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules""; "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome"; "a clone's term link becomes text too"; "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M17 | a fold's hidden is dropped from a copied paragraph | `src/enhance/cards.ts` | `  if (c.getAttribute('hidden') === 'until-found') c.removeAttribute('hidden'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a section folded away still shows its paragraph: the fold's hidden is not cloned" |
| L2-T17-M18 | only a fold's hidden is dropped: the document's stays | `src/enhance/cards.ts` | `if (c.getAttribute('hidden') === 'until-found')` → `if (c.getAttribute('hidden') !== null)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a paragraph the document hid stays hidden in its copy: only a fold's hidden goes" |
| L2-T17-M19 | a cell's copy is deep | `src/enhance/cards.ts` | `Array.from(el.childNodes, (n) => n.cloneNode(true))` → `Array.from(el.childNodes, (n) => n.cloneNode(false))` | `test/enhance-cards.test.ts` (`rc=1`, red): 8 failed \| 76 passed (84). "an ID row: its ID, the status words of its pill and its group; each cell under its header, the ID cell left out"; "an ID row whose first cell holds more than the ID shows that cell too"; "a term: its name, its glossary's section, each definition with its qualifier"; "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome"; "a clone's term link becomes text too" and 3 more |
| L2-T17-M20 | a paragraph's copy is deep | `src/enhance/cards.ts` | `const c = el.cloneNode(true) as Element;` → `const c = el.cloneNode(false) as Element;` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules""; "a lettered section: its title, and the first paragraph after its heading"; "a paragraph the document hid stays hidden in its copy: only a fold's hidden goes"; "a section folded away still shows its paragraph: the fold's hidden is not cloned" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M1",
    "guard": "show() of a context no instance made answers false",
    "file": "src/enhance/cards.ts",
    "old": "  if (state === undefined) return false;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M2",
    "guard": "show() once the instance is not live answers false",
    "file": "src/enhance/cards.ts",
    "old": "return ctx.operate(() => state.show(trigger)) === true;",
    "new": "return ctx.operate(() => state.show(trigger)) !== false;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M3",
    "guard": "an event with no target (relatedTarget null) is no element",
    "file": "src/enhance/cards.ts",
    "old": "  if (n === null) return null;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M4",
    "guard": "an event whose target is a text counts as its parent's",
    "file": "src/enhance/cards.ts",
    "old": "return n.nodeType === 3 ? n.parentElement : null;",
    "new": "return null;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M5",
    "guard": "hidden chrome in the ID cell is passed over",
    "file": "src/enhance/cards.ts",
    "old": "    if (x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute('hidden')) continue;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M6",
    "guard": "a copied cross-reference becomes its text",
    "file": "src/enhance/cards.ts",
    "old": "box.querySelectorAll('a.xref, a.term')",
    "new": "box.querySelectorAll('a.term')",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M7",
    "guard": "a copied term link becomes its text",
    "file": "src/enhance/cards.ts",
    "old": "box.querySelectorAll('a.xref, a.term')",
    "new": "box.querySelectorAll('a.xref')",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M8",
    "guard": "a copy keeps no input",
    "file": "src/enhance/cards.ts",
    "old": "'input, button, select, textarea'",
    "new": "'button, select, textarea'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M9",
    "guard": "a copy keeps no button",
    "file": "src/enhance/cards.ts",
    "old": "'input, button, select, textarea'",
    "new": "'input, select, textarea'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M10",
    "guard": "a copy keeps no select",
    "file": "src/enhance/cards.ts",
    "old": "'input, button, select, textarea'",
    "new": "'input, button, textarea'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M11",
    "guard": "a copy keeps no textarea",
    "file": "src/enhance/cards.ts",
    "old": "'input, button, select, textarea'",
    "new": "'input, button, select'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M12",
    "guard": "a copy keeps no id",
    "file": "src/enhance/cards.ts",
    "old": "    el.removeAttribute('id');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M13",
    "guard": "a copy keeps no render() line mark",
    "file": "src/enhance/cards.ts",
    "old": "    el.removeAttribute('data-line');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M14",
    "guard": "every copied element is chrome",
    "file": "src/enhance/cards.ts",
    "old": "    el.setAttribute('data-docreader-chrome', '');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M15",
    "guard": "a term's definitions are scrubbed",
    "file": "src/enhance/cards.ts",
    "old": "  scrub(body);\n  const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to definition →'",
    "new": "  const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to definition →'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M16",
    "guard": "an ID's body is scrubbed",
    "file": "src/enhance/cards.ts",
    "old": "  scrub(body);\n  const go = chrome(doc, 'a', { className: 'xc-go', text: `Go to",
    "new": "  const go = chrome(doc, 'a', { className: 'xc-go', text: `Go to",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M17",
    "guard": "a fold's hidden is dropped from a copied paragraph",
    "file": "src/enhance/cards.ts",
    "old": "  if (c.getAttribute('hidden') === 'until-found') c.removeAttribute('hidden');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M18",
    "guard": "only a fold's hidden is dropped: the document's stays",
    "file": "src/enhance/cards.ts",
    "old": "if (c.getAttribute('hidden') === 'until-found')",
    "new": "if (c.getAttribute('hidden') !== null)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M19",
    "guard": "a cell's copy is deep",
    "file": "src/enhance/cards.ts",
    "old": "Array.from(el.childNodes, (n) => n.cloneNode(true))",
    "new": "Array.from(el.childNodes, (n) => n.cloneNode(false))",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M20",
    "guard": "a paragraph's copy is deep",
    "file": "src/enhance/cards.ts",
    "old": "const c = el.cloneNode(true) as Element;",
    "new": "const c = el.cloneNode(false) as Element;",
    "tests": "test/enhance-cards.test.ts"
  }
]
```

## The link's href and the pill (L2-T17-M21 to L2-T17-M37)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M21 | the heading before may be an h3 | `src/enhance/cards.ts` | `if ((p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== '') return p.id;` → `if (p.localName === 'h2' && p.id !== '') return p.id;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#"" |
| L2-T17-M22 | a heading with no id is passed over | `src/enhance/cards.ts` | `if ((p.localName === 'h2' \|\| p.localName === 'h3') && p.id !== '') return p.id;` → `if (p.localName === 'h2' \|\| p.localName === 'h3') return p.id;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#"" |
| L2-T17-M23 | an In short box gives its heading | `src/enhance/cards.ts` | `if (p.classList.contains('short') \|\| p.classList.contains('callout')) {` → `if (p.classList.contains('callout')) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#"" |
| L2-T17-M24 | a Where things stand box gives its heading | `src/enhance/cards.ts` | `if (p.classList.contains('short') \|\| p.classList.contains('callout')) {` → `if (p.classList.contains('short')) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#"" |
| L2-T17-M25 | a box with no heading is passed over | `src/enhance/cards.ts` | `        if (h !== null) return h.id;` → `        return h === null ? '' : h.id;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#"" |
| L2-T17-M26 | the search goes on through the block's ancestors | `src/enhance/cards.ts` | `n !== root; n = n.parentElement)` → `n !== root; n = null)` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#""; "a term: its name, its glossary's section, each definition with its qualifier" |
| L2-T17-M27 | no heading: the href is "#" | `src/enhance/cards.ts` | `  return ''; ⏎ } ⏎  ⏎ /** The pill` → `  return 'none'; ⏎ } ⏎  ⏎ /** The pill` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#""; "a term with no qualifier has no label; a glossary with no section reads "Glossary"" |
| L2-T17-M28 | a row's pills are the layout's | `src/enhance/cards.ts` | `.filter((el) => el.hasAttribute(CHROME_ATTR));` → `;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the words are the row's last pill's; a pill the document wrote is none of the layout's" |
| L2-T17-M29 | a row's words are its last pill's | `src/enhance/cards.ts` | `return pills[pills.length - 1] ?? null;` → `return pills[0] ?? null;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the words are the row's last pill's; a pill the document wrote is none of the layout's" |
| L2-T17-M30 | a row's words are its pill's | `src/enhance/cards.ts` | `    return pills[pills.length - 1] ?? null; ⏎ ` → `    return null; ⏎ ` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "an ID row: its ID, the status words of its pill and its group; each cell under its header, the ID cell left out"; "the words are the row's last pill's; a pill the document wrote is none of the layout's"; "a pill with no colour role shows as a plain pill"; "the status words come from the target's pill, never from the index entry" |
| L2-T17-M31 | a rule's words are its head's pill's | `src/enhance/cards.ts` | `return entry.kind === 'rule' ? entry.target.querySelector(':scope > .rule-head > .pill') : null;` → `return null;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules""; "a rule's status words are read as one line, however the document broke them" |
| L2-T17-M32 | a pill with no colour role is a plain pill | `src/enhance/cards.ts` | `className: entry.status === null ? 'pill' : 'pill ${entry.status}'` → `className: 'pill ${String(entry.status)}'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pill with no colour role shows as a plain pill" |
| L2-T17-M33 | the words are read as one line | `src/enhance/cards.ts` | `text: squash(pill.textContent ?? '')` → `text: pill.textContent ?? ''` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a rule's status words are read as one line, however the document broke them" |
| L2-T17-M34 | the group is shown | `src/enhance/cards.ts` | `head.appendChild(chrome(doc, 'span', { className: 'xc-src', text: entry.group }));` → `head.appendChild(chrome(doc, 'span', { className: 'xc-src', text: '' }));` | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "an ID row: its ID, the status words of its pill and its group; each cell under its header, the ID cell left out"; "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules""; "a lettered section: its title, and the first paragraph after its heading"; "the words are the row's last pill's; a pill the document wrote is none of the layout's"; "a pill with no colour role shows as a plain pill" and 1 more |
| L2-T17-M35 | the href names the target's own id or ID first | `src/enhance/cards.ts` | `nav.idOf(goal) ?? headingIdBefore(root, goal)` → `headingIdBefore(root, goal)` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "an ID row: its ID, the status words of its pill and its group; each cell under its header, the ID cell left out"; "a lettered section: its title, and the first paragraph after its heading" |
| L2-T17-M36 | else the heading before it | `src/enhance/cards.ts` | `nav.idOf(goal) ?? headingIdBefore(root, goal)` → `nav.idOf(goal) ?? ''` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#""; "a term: its name, its glossary's section, each definition with its qualifier" |
| L2-T17-M37 | the href is encoded | `src/enhance/cards.ts` | `'#${encodeURIComponent(nav.idOf(goal) ?? headingIdBefore(root, goal))}'` → `'#${nav.idOf(goal) ?? headingIdBefore(root, goal)}'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term's link names the heading before its glossary: an h2 or h3, a box's heading, encoded; none: "#"" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M21",
    "guard": "the heading before may be an h3",
    "file": "src/enhance/cards.ts",
    "old": "if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p.id;",
    "new": "if (p.localName === 'h2' && p.id !== '') return p.id;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M22",
    "guard": "a heading with no id is passed over",
    "file": "src/enhance/cards.ts",
    "old": "if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p.id;",
    "new": "if (p.localName === 'h2' || p.localName === 'h3') return p.id;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M23",
    "guard": "an In short box gives its heading",
    "file": "src/enhance/cards.ts",
    "old": "if (p.classList.contains('short') || p.classList.contains('callout')) {",
    "new": "if (p.classList.contains('callout')) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M24",
    "guard": "a Where things stand box gives its heading",
    "file": "src/enhance/cards.ts",
    "old": "if (p.classList.contains('short') || p.classList.contains('callout')) {",
    "new": "if (p.classList.contains('short')) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M25",
    "guard": "a box with no heading is passed over",
    "file": "src/enhance/cards.ts",
    "old": "        if (h !== null) return h.id;",
    "new": "        return h === null ? '' : h.id;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M26",
    "guard": "the search goes on through the block's ancestors",
    "file": "src/enhance/cards.ts",
    "old": "n !== root; n = n.parentElement)",
    "new": "n !== root; n = null)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M27",
    "guard": "no heading: the href is \"#\"",
    "file": "src/enhance/cards.ts",
    "old": "  return '';\n}\n\n/** The pill",
    "new": "  return 'none';\n}\n\n/** The pill",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M28",
    "guard": "a row's pills are the layout's",
    "file": "src/enhance/cards.ts",
    "old": ".filter((el) => el.hasAttribute(CHROME_ATTR));",
    "new": ";",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M29",
    "guard": "a row's words are its last pill's",
    "file": "src/enhance/cards.ts",
    "old": "return pills[pills.length - 1] ?? null;",
    "new": "return pills[0] ?? null;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M30",
    "guard": "a row's words are its pill's",
    "file": "src/enhance/cards.ts",
    "old": "    return pills[pills.length - 1] ?? null;\n",
    "new": "    return null;\n",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M31",
    "guard": "a rule's words are its head's pill's",
    "file": "src/enhance/cards.ts",
    "old": "return entry.kind === 'rule' ? entry.target.querySelector(':scope > .rule-head > .pill') : null;",
    "new": "return null;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M32",
    "guard": "a pill with no colour role is a plain pill",
    "file": "src/enhance/cards.ts",
    "old": "className: entry.status === null ? 'pill' : `pill ${entry.status}`",
    "new": "className: `pill ${String(entry.status)}`",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M33",
    "guard": "the words are read as one line",
    "file": "src/enhance/cards.ts",
    "old": "text: squash(pill.textContent ?? '')",
    "new": "text: pill.textContent ?? ''",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M34",
    "guard": "the group is shown",
    "file": "src/enhance/cards.ts",
    "old": "head.appendChild(chrome(doc, 'span', { className: 'xc-src', text: entry.group }));",
    "new": "head.appendChild(chrome(doc, 'span', { className: 'xc-src', text: '' }));",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M35",
    "guard": "the href names the target's own id or ID first",
    "file": "src/enhance/cards.ts",
    "old": "nav.idOf(goal) ?? headingIdBefore(root, goal)",
    "new": "headingIdBefore(root, goal)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M36",
    "guard": "else the heading before it",
    "file": "src/enhance/cards.ts",
    "old": "nav.idOf(goal) ?? headingIdBefore(root, goal)",
    "new": "nav.idOf(goal) ?? ''",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M37",
    "guard": "the href is encoded",
    "file": "src/enhance/cards.ts",
    "old": "`#${encodeURIComponent(nav.idOf(goal) ?? headingIdBefore(root, goal))}`",
    "new": "`#${nav.idOf(goal) ?? headingIdBefore(root, goal)}`",
    "tests": "test/enhance-cards.test.ts"
  }
]
```

## What the card shows (L2-T17-M38 to L2-T17-M53)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M38 | the ID cell alone is left out | `src/enhance/cards.ts` | `      if (i === 0 && shownText(cell) === entry.id) return; ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "an ID row: its ID, the status words of its pill and its group; each cell under its header, the ID cell left out"; "a hidden bullet in the ID cell is passed over: the cell is still the ID alone"; "a cell other than the first is shown even when it is the ID"; "a cell under an empty header, or past the headers, has no label"; "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" and 1 more |
| L2-T17-M39 | only the first cell is left out | `src/enhance/cards.ts` | `if (i === 0 && shownText(cell) === entry.id) return;` → `if (shownText(cell) === entry.id) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a cell other than the first is shown even when it is the ID" |
| L2-T17-M40 | an empty header gives no label | `src/enhance/cards.ts` | `if (label !== undefined && label !== '') row.appendChild` → `if (label !== undefined) row.appendChild` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a cell under an empty header, or past the headers, has no label" |
| L2-T17-M41 | a cell past the headers has no label | `src/enhance/cards.ts` | `if (label !== undefined && label !== '') row.appendChild` → `if (label !== '') row.appendChild` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a cell under an empty header, or past the headers, has no label" |
| L2-T17-M42 | a rule's copy keeps no class | `src/enhance/cards.ts` | `    p.removeAttribute('class'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules"" |
| L2-T17-M43 | a rule's copy keeps no head | `src/enhance/cards.ts` | `    for (const h of Array.from(p.children)) if (h.classList.contains('rule-head')) h.remove(); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a rule: its paragraph without its head, the status words of the head's first pill, the group "Rules"" |
| L2-T17-M44 | a section's title leaves out its chrome | `src/enhance/cards.ts` | `headingText(target, (el) => el.hasAttribute(CHROME_ATTR))` → `headingText(target, () => false)` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "a lettered section: its title, and the first paragraph after its heading"; "a section's paragraph is found past chrome after the heading, and not past the next heading"; "a section folded away still shows its paragraph: the fold's hidden is not cloned" |
| L2-T17-M45 | a section's paragraph is found past chrome | `src/enhance/cards.ts` | `    while (n !== null && n.localName !== 'p' && !/^h[1-3]$/.test(n.localName)) n = n.nextElementSibl…` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a section folded away still shows its paragraph: the fold's hidden is not cloned" |
| L2-T17-M46 | the search for a section's paragraph stops at a heading | `src/enhance/cards.ts` | `while (n !== null && n.localName !== 'p' && !/^h[1-3]$/.test(n.localName))` → `while (n !== null && n.localName !== 'p')` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a section's paragraph is found past chrome after the heading, and not past the next heading" |
| L2-T17-M47 | only a paragraph is copied | `src/enhance/cards.ts` | `if (n !== null && n.localName === 'p') body.appendChild(copyOf(n));` → `if (n !== null) body.appendChild(copyOf(n));` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a section's paragraph is found past chrome after the heading, and not past the next heading" |
| L2-T17-M48 | a figure shows its whole caption | `src/enhance/cards.ts` | `ctx.figures.of(target)?.caption ?? entry.title` → `entry.title` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a figure: its whole caption" |
| L2-T17-M49 | a term with no section reads Glossary | `src/enhance/cards.ts` | `text: term.section === '' ? 'Glossary' : term.section` → `text: term.section` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term with no qualifier has no label; a glossary with no section reads "Glossary"" |
| L2-T17-M50 | a definition with no qualifier has no label | `src/enhance/cards.ts` | `    if (d.qual !== '') def.appendChild(` → `    def.appendChild(` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term with no qualifier has no label; a glossary with no section reads "Glossary"" |
| L2-T17-M51 | every definition is shown | `src/enhance/cards.ts` | `for (const d of term.defs) {` → `for (const d of term.defs.slice(0, 1)) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term: its name, its glossary's section, each definition with its qualifier" |
| L2-T17-M52 | a trigger's term is read first | `src/enhance/cards.ts` | `if (term !== undefined && term !== '') {` → `if (term !== undefined && term !== '' && data['ref'] === undefined) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "data-term names a term first; an empty one leaves data-ref to name an ID" |
| L2-T17-M53 | an empty data-term names nothing: data-ref is read | `src/enhance/cards.ts` | `if (term !== undefined && term !== '') {` → `if (term !== undefined) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "data-term names a term first; an empty one leaves data-ref to name an ID" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M38",
    "guard": "the ID cell alone is left out",
    "file": "src/enhance/cards.ts",
    "old": "      if (i === 0 && shownText(cell) === entry.id) return;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M39",
    "guard": "only the first cell is left out",
    "file": "src/enhance/cards.ts",
    "old": "if (i === 0 && shownText(cell) === entry.id) return;",
    "new": "if (shownText(cell) === entry.id) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M40",
    "guard": "an empty header gives no label",
    "file": "src/enhance/cards.ts",
    "old": "if (label !== undefined && label !== '') row.appendChild",
    "new": "if (label !== undefined) row.appendChild",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M41",
    "guard": "a cell past the headers has no label",
    "file": "src/enhance/cards.ts",
    "old": "if (label !== undefined && label !== '') row.appendChild",
    "new": "if (label !== '') row.appendChild",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M42",
    "guard": "a rule's copy keeps no class",
    "file": "src/enhance/cards.ts",
    "old": "    p.removeAttribute('class');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M43",
    "guard": "a rule's copy keeps no head",
    "file": "src/enhance/cards.ts",
    "old": "    for (const h of Array.from(p.children)) if (h.classList.contains('rule-head')) h.remove();\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M44",
    "guard": "a section's title leaves out its chrome",
    "file": "src/enhance/cards.ts",
    "old": "headingText(target, (el) => el.hasAttribute(CHROME_ATTR))",
    "new": "headingText(target, () => false)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M45",
    "guard": "a section's paragraph is found past chrome",
    "file": "src/enhance/cards.ts",
    "old": "    while (n !== null && n.localName !== 'p' && !/^h[1-3]$/.test(n.localName)) n = n.nextElementSibling;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M46",
    "guard": "the search for a section's paragraph stops at a heading",
    "file": "src/enhance/cards.ts",
    "old": "while (n !== null && n.localName !== 'p' && !/^h[1-3]$/.test(n.localName))",
    "new": "while (n !== null && n.localName !== 'p')",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M47",
    "guard": "only a paragraph is copied",
    "file": "src/enhance/cards.ts",
    "old": "if (n !== null && n.localName === 'p') body.appendChild(copyOf(n));",
    "new": "if (n !== null) body.appendChild(copyOf(n));",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M48",
    "guard": "a figure shows its whole caption",
    "file": "src/enhance/cards.ts",
    "old": "ctx.figures.of(target)?.caption ?? entry.title",
    "new": "entry.title",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M49",
    "guard": "a term with no section reads Glossary",
    "file": "src/enhance/cards.ts",
    "old": "text: term.section === '' ? 'Glossary' : term.section",
    "new": "text: term.section",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M50",
    "guard": "a definition with no qualifier has no label",
    "file": "src/enhance/cards.ts",
    "old": "    if (d.qual !== '') def.appendChild(",
    "new": "    def.appendChild(",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M51",
    "guard": "every definition is shown",
    "file": "src/enhance/cards.ts",
    "old": "for (const d of term.defs) {",
    "new": "for (const d of term.defs.slice(0, 1)) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M52",
    "guard": "a trigger's term is read first",
    "file": "src/enhance/cards.ts",
    "old": "if (term !== undefined && term !== '') {",
    "new": "if (term !== undefined && term !== '' && data['ref'] === undefined) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M53",
    "guard": "an empty data-term names nothing: data-ref is read",
    "file": "src/enhance/cards.ts",
    "old": "if (term !== undefined && term !== '') {",
    "new": "if (term !== undefined) {",
    "tests": "test/enhance-cards.test.ts"
  }
]
```

## Showing, hiding and placing (L2-T17-M54 to L2-T17-M94)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M54 | a trigger outside the root shows nothing | `src/enhance/cards.ts` | `    if (!root.contains(a)) return false; ⏎     const what` → `    const what` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest"; "show() of another root's context never reaches this root, and does nothing once destroyed" |
| L2-T17-M55 | a trigger that names nothing shows nothing | `src/enhance/cards.ts` | `if (what === null \|\| a.closest('.rv-hide') !== null) return false;` → `if (a.closest('.rv-hide') !== null) return false;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest" |
| L2-T17-M56 | a block Play has not revealed shows nothing | `src/enhance/cards.ts` | `if (what === null \|\| a.closest('.rv-hide') !== null) return false;` → `if (what === null) return false;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a block Play has not revealed yet shows nothing" |
| L2-T17-M57 | showing calls off a pending hide | `src/enhance/cards.ts` | `    hideTimer = stop(hideTimer); ⏎     if (a !== shown) {` → `    if (a !== shown) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "show() answers false for a trigger out of the window, and calls off a pending hide" |
| L2-T17-M58 | the content is made only for a new trigger | `src/enhance/cards.ts` | `    if (a !== shown) { ⏎       card ??= makeCard();` → `    if (true) { ⏎       card ??= makeCard();` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest" |
| L2-T17-M59 | the card is made once | `src/enhance/cards.ts` | `card ??= makeCard();` → `card = makeCard();` | `test/enhance-cards.test.ts` (`rc=1`, red): 11 failed \| 73 passed (84). "the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it"; "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll"; "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it"; "a trigger given the focus back shows its card again once the focus comes back to it later"; "going anywhere closes it: a link the reader follows, the card's own link, the keys" and 6 more |
| L2-T17-M60 | the previous trigger is no longer expanded | `src/enhance/cards.ts` | `      if (shown !== null) journal.setAttribute(shown, 'aria-expanded', 'false'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it" |
| L2-T17-M61 | the card is labelled for what it shows | `src/enhance/cards.ts` | `      journal.setAttribute(card, 'aria-label', what.kind` → `      void (what.kind` | `test/enhance-cards.test.ts` (`rc=1`, red): 7 failed \| 77 passed (84). "the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it"; "a second trigger hovered before the delay is the one shown"; "an event whose target is the trigger's text counts as the trigger's"; "leaving another trigger leaves an open card alone, and a touch pointer leaving hides nothing"; "a click on a block shows its card, by any pointer; the block goes nowhere itself" and 2 more |
| L2-T17-M62 | a term card is marked is-term | `src/enhance/cards.ts` | `      journal.toggleClass(card, 'is-term', what.kind === 'term'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a term: its name, its glossary's section, each definition with its qualifier" |
| L2-T17-M63 | the card goes in the root once | `src/enhance/cards.ts` | `if (card.parentNode === null) journal.insert(card, root, null);` → `journal.insert(card, root, null);` | `test/enhance-cards.test.ts` (`rc=1`, red): 10 failed \| 74 passed (84). "the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it"; "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll"; "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it"; "a trigger given the focus back shows its card again once the focus comes back to it later"; "going anywhere closes it: a link the reader follows, the card's own link, the keys" and 5 more |
| L2-T17-M64 | the card opens | `src/enhance/cards.ts` | `      journal.toggleClass(card, 'open', true); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 37 failed \| 47 passed (84). "shows after the delay, and only for a mouse"; "a pointer that leaves before the delay shows nothing, wherever it goes"; "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it"; "the pointer back on the trigger keeps the card; leaving the card again starts the delay again"; "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off" and 15 more |
| L2-T17-M65 | the trigger is expanded | `src/enhance/cards.ts` | `      journal.setAttribute(a, 'aria-expanded', 'true'); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it" |
| L2-T17-M66 | the trigger controls the card | `src/enhance/cards.ts` | `      journal.setAttribute(a, 'aria-controls', card.id); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it" |
| L2-T17-M67 | the card follows the scroll while it shows | `src/enhance/cards.ts` | `      following ??= env.onScroll(() => { ⏎         place(); ⏎       }); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 9 failed \| 75 passed (84). "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll"; "below the trigger when the card fits there"; "above the trigger when below is short and above is longer, under the bar"; "the bar's height comes from --bar-h, and is none while the bar is hidden"; "below when the room is equal; the height is never under the floor" and 4 more |
| L2-T17-M68 | showing places the card | `src/enhance/cards.ts` | `    place(); ⏎     return shown === a;` → `    return shown === a;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "show() answers false for a trigger out of the window, and calls off a pending hide"; "show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest" |
| L2-T17-M69 | show() answers whether the card shows for that trigger | `src/enhance/cards.ts` | `    return shown === a; ⏎   };` → `    return true; ⏎   };` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "show() answers false for a trigger out of the window, and calls off a pending hide" |
| L2-T17-M70 | hiding calls off a pending show | `src/enhance/cards.ts` | `    showTimer = stop(showTimer); ⏎     hideTimer = stop(hideTimer); ⏎     const go` → `    hideTimer = stop(hideTimer); ⏎     const go` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off" |
| L2-T17-M71 | a second hide starts the delay again | `src/enhance/cards.ts` | `    showTimer = stop(showTimer); ⏎     hideTimer = stop(hideTimer); ⏎     const go` → `    showTimer = stop(showTimer); ⏎     const go` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the pointer back on the trigger keeps the card; leaving the card again starts the delay again" |
| L2-T17-M72 | hiding with nothing shown does nothing | `src/enhance/cards.ts` | `      if (shown === null \|\| card === null) return;` → `      if (card === null) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off" |
| L2-T17-M73 | the trigger is collapsed when its card hides | `src/enhance/cards.ts` | `      journal.setAttribute(shown, 'aria-expanded', 'false'); ⏎       shown = null;` → `      shown = null;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Escape on the trigger closes the card, keeps the focus there, and does not open it again" |
| L2-T17-M74 | a hidden card hears no scroll | `src/enhance/cards.ts` | `      following = stop(following); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll" |
| L2-T17-M75 | the card closes | `src/enhance/cards.ts` | `      journal.toggleClass(card, 'open', false); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 23 failed \| 61 passed (84). "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it"; "the pointer back on the trigger keeps the card; leaving the card again starts the delay again"; "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off"; "dragging in the full-screen figure keeps the card on its block (Task 23)"; "focus shows at once; focus moving on hides after the delay, and into the card keeps it" and 15 more |
| L2-T17-M76 | a hide waits HIDE_DELAY_MS | `src/enhance/cards.ts` | `    else hideTimer = env.timeout(go, HIDE_DELAY_MS);` → `    else go();` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it"; "the pointer back on the trigger keeps the card; leaving the card again starts the delay again"; "focus shows at once; focus moving on hides after the delay, and into the card keeps it"; "after destroy no timer fires: a pending show or hide is cancelled, and does nothing" |
| L2-T17-M77 | a trigger gone from the document hides its card | `src/enhance/cards.ts` | `    if (!root.contains(a)) { ⏎       hide(true);` → `    if (false) { ⏎       hide(true);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "follows the trigger on scroll, and hides once the trigger leaves the window or the document" |
| L2-T17-M78 | a trigger below the window hides its card | `src/enhance/cards.ts` | `if (r.bottom < 0 \|\| r.top > h) {` → `if (r.bottom < 0) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "follows the trigger on scroll, and hides once the trigger leaves the window or the document" |
| L2-T17-M79 | a trigger above the window hides its card | `src/enhance/cards.ts` | `if (r.bottom < 0 \|\| r.top > h) {` → `if (r.top > h) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "show() answers false for a trigger out of the window, and calls off a pending hide"; "follows the trigger on scroll, and hides once the trigger leaves the window or the document" |
| L2-T17-M80 | the room below keeps ROOM | `src/enhance/cards.ts` | `const below = h - r.bottom - ROOM;` → `const below = h - r.bottom;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "the bar's height comes from --bar-h, and is none while the bar is hidden"; "below when the room is equal; the height is never under the floor" |
| L2-T17-M81 | the room above is under the bar | `src/enhance/cards.ts` | `const above = r.top - barHeight() - ROOM;` → `const above = r.top - ROOM;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the bar's height comes from --bar-h, and is none while the bar is hidden" |
| L2-T17-M82 | the room above keeps ROOM | `src/enhance/cards.ts` | `const above = r.top - barHeight() - ROOM;` → `const above = r.top - barHeight();` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "the bar's height comes from --bar-h, and is none while the bar is hidden"; "below when the room is equal; the height is never under the floor"; "with no --bar-h the room above runs to the window's top" |
| L2-T17-M83 | the bar is none while hidden | `src/enhance/cards.ts` | `    if (root.classList.contains('bar-hidden')) return 0; ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the bar's height comes from --bar-h, and is none while the bar is hidden" |
| L2-T17-M84 | the bar's height is --bar-h | `src/enhance/cards.ts` | `Number.parseFloat(env.computed(root, '--bar-h'))` → `Number.parseFloat('0')` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the bar's height comes from --bar-h, and is none while the bar is hidden" |
| L2-T17-M85 | no --bar-h is no bar | `src/enhance/cards.ts` | `return Number.isFinite(h) ? h : 0;` → `return h;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "with no --bar-h the room above runs to the window's top"; "the natural height is measured afresh each time: the last max-height is cleared first" |
| L2-T17-M86 | the natural height is measured afresh | `src/enhance/cards.ts` | `    journal.setStyle(card, 'max-height', null); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "below the trigger when the card fits there"; "above the trigger when below is short and above is longer, under the bar"; "the bar's height comes from --bar-h, and is none while the bar is hidden"; "below when the room is equal; the height is never under the floor"; "with no --bar-h the room above runs to the window's top" and 1 more |
| L2-T17-M87 | below when the card fits there | `src/enhance/cards.ts` | `const down = natural <= below \|\| below >= above;` → `const down = below >= above;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "below when the card fits there, even with more room above" |
| L2-T17-M88 | below when there is no less room there | `src/enhance/cards.ts` | `const down = natural <= below \|\| below >= above;` → `const down = natural <= below;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "the bar's height comes from --bar-h, and is none while the bar is hidden"; "below when the room is equal; the height is never under the floor" |
| L2-T17-M89 | the max-height has a floor | `src/enhance/cards.ts` | `String(Math.max(MIN_HEIGHT, Math.min(natural, down ? below : above)))` → `String(Math.min(natural, down ? below : above))` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "below when the card fits there, even with more room above"; "below when the room is equal; the height is never under the floor"; "the natural height is measured afresh each time: the last max-height is cleared first" |
| L2-T17-M90 | the max-height is at most the natural height | `src/enhance/cards.ts` | `String(Math.max(MIN_HEIGHT, Math.min(natural, down ? below : above)))` → `String(Math.max(MIN_HEIGHT, down ? below : above))` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "below the trigger when the card fits there"; "above the trigger when below is short and above is longer, under the bar"; "below when the card fits there, even with more room above"; "the natural height is measured afresh each time: the last max-height is cleared first" |
| L2-T17-M91 | kept EDGE from the left | `src/enhance/cards.ts` | `Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE)` → `Math.min(r.left - LEAD, w - card.offsetWidth - EDGE)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "clamped to the viewport on the left and the right" |
| L2-T17-M92 | kept EDGE from the right | `src/enhance/cards.ts` | `Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE)` → `Math.max(EDGE, r.left - LEAD)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "clamped to the viewport on the left and the right" |
| L2-T17-M93 | GAP below the trigger | `src/enhance/cards.ts` | `const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;` → `const y = down ? r.bottom : r.top - card.offsetHeight - GAP;` | `test/enhance-cards.test.ts` (`rc=1`, red): 5 failed \| 79 passed (84). "below the trigger when the card fits there"; "below when the card fits there, even with more room above"; "below when the room is equal; the height is never under the floor"; "follows the trigger on scroll, and hides once the trigger leaves the window or the document"; "show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest" |
| L2-T17-M94 | GAP above the trigger, by the card's height | `src/enhance/cards.ts` | `const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;` → `const y = down ? r.bottom + GAP : r.top - GAP;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "above the trigger when below is short and above is longer, under the bar" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M54",
    "guard": "a trigger outside the root shows nothing",
    "file": "src/enhance/cards.ts",
    "old": "    if (!root.contains(a)) return false;\n    const what",
    "new": "    const what",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M55",
    "guard": "a trigger that names nothing shows nothing",
    "file": "src/enhance/cards.ts",
    "old": "if (what === null || a.closest('.rv-hide') !== null) return false;",
    "new": "if (a.closest('.rv-hide') !== null) return false;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M56",
    "guard": "a block Play has not revealed shows nothing",
    "file": "src/enhance/cards.ts",
    "old": "if (what === null || a.closest('.rv-hide') !== null) return false;",
    "new": "if (what === null) return false;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M57",
    "guard": "showing calls off a pending hide",
    "file": "src/enhance/cards.ts",
    "old": "    hideTimer = stop(hideTimer);\n    if (a !== shown) {",
    "new": "    if (a !== shown) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M58",
    "guard": "the content is made only for a new trigger",
    "file": "src/enhance/cards.ts",
    "old": "    if (a !== shown) {\n      card ??= makeCard();",
    "new": "    if (true) {\n      card ??= makeCard();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M59",
    "guard": "the card is made once",
    "file": "src/enhance/cards.ts",
    "old": "card ??= makeCard();",
    "new": "card = makeCard();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M60",
    "guard": "the previous trigger is no longer expanded",
    "file": "src/enhance/cards.ts",
    "old": "      if (shown !== null) journal.setAttribute(shown, 'aria-expanded', 'false');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M61",
    "guard": "the card is labelled for what it shows",
    "file": "src/enhance/cards.ts",
    "old": "      journal.setAttribute(card, 'aria-label', what.kind",
    "new": "      void (what.kind",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M62",
    "guard": "a term card is marked is-term",
    "file": "src/enhance/cards.ts",
    "old": "      journal.toggleClass(card, 'is-term', what.kind === 'term');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M63",
    "guard": "the card goes in the root once",
    "file": "src/enhance/cards.ts",
    "old": "if (card.parentNode === null) journal.insert(card, root, null);",
    "new": "journal.insert(card, root, null);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M64",
    "guard": "the card opens",
    "file": "src/enhance/cards.ts",
    "old": "      journal.toggleClass(card, 'open', true);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M65",
    "guard": "the trigger is expanded",
    "file": "src/enhance/cards.ts",
    "old": "      journal.setAttribute(a, 'aria-expanded', 'true');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M66",
    "guard": "the trigger controls the card",
    "file": "src/enhance/cards.ts",
    "old": "      journal.setAttribute(a, 'aria-controls', card.id);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M67",
    "guard": "the card follows the scroll while it shows",
    "file": "src/enhance/cards.ts",
    "old": "      following ??= env.onScroll(() => {\n        place();\n      });\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M68",
    "guard": "showing places the card",
    "file": "src/enhance/cards.ts",
    "old": "    place();\n    return shown === a;",
    "new": "    return shown === a;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M69",
    "guard": "show() answers whether the card shows for that trigger",
    "file": "src/enhance/cards.ts",
    "old": "    return shown === a;\n  };",
    "new": "    return true;\n  };",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M70",
    "guard": "hiding calls off a pending show",
    "file": "src/enhance/cards.ts",
    "old": "    showTimer = stop(showTimer);\n    hideTimer = stop(hideTimer);\n    const go",
    "new": "    hideTimer = stop(hideTimer);\n    const go",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M71",
    "guard": "a second hide starts the delay again",
    "file": "src/enhance/cards.ts",
    "old": "    showTimer = stop(showTimer);\n    hideTimer = stop(hideTimer);\n    const go",
    "new": "    showTimer = stop(showTimer);\n    const go",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M72",
    "guard": "hiding with nothing shown does nothing",
    "file": "src/enhance/cards.ts",
    "old": "      if (shown === null || card === null) return;",
    "new": "      if (card === null) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M73",
    "guard": "the trigger is collapsed when its card hides",
    "file": "src/enhance/cards.ts",
    "old": "      journal.setAttribute(shown, 'aria-expanded', 'false');\n      shown = null;",
    "new": "      shown = null;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M74",
    "guard": "a hidden card hears no scroll",
    "file": "src/enhance/cards.ts",
    "old": "      following = stop(following);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M75",
    "guard": "the card closes",
    "file": "src/enhance/cards.ts",
    "old": "      journal.toggleClass(card, 'open', false);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M76",
    "guard": "a hide waits HIDE_DELAY_MS",
    "file": "src/enhance/cards.ts",
    "old": "    else hideTimer = env.timeout(go, HIDE_DELAY_MS);",
    "new": "    else go();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M77",
    "guard": "a trigger gone from the document hides its card",
    "file": "src/enhance/cards.ts",
    "old": "    if (!root.contains(a)) {\n      hide(true);",
    "new": "    if (false) {\n      hide(true);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M78",
    "guard": "a trigger below the window hides its card",
    "file": "src/enhance/cards.ts",
    "old": "if (r.bottom < 0 || r.top > h) {",
    "new": "if (r.bottom < 0) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M79",
    "guard": "a trigger above the window hides its card",
    "file": "src/enhance/cards.ts",
    "old": "if (r.bottom < 0 || r.top > h) {",
    "new": "if (r.top > h) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M80",
    "guard": "the room below keeps ROOM",
    "file": "src/enhance/cards.ts",
    "old": "const below = h - r.bottom - ROOM;",
    "new": "const below = h - r.bottom;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M81",
    "guard": "the room above is under the bar",
    "file": "src/enhance/cards.ts",
    "old": "const above = r.top - barHeight() - ROOM;",
    "new": "const above = r.top - ROOM;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M82",
    "guard": "the room above keeps ROOM",
    "file": "src/enhance/cards.ts",
    "old": "const above = r.top - barHeight() - ROOM;",
    "new": "const above = r.top - barHeight();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M83",
    "guard": "the bar is none while hidden",
    "file": "src/enhance/cards.ts",
    "old": "    if (root.classList.contains('bar-hidden')) return 0;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M84",
    "guard": "the bar's height is --bar-h",
    "file": "src/enhance/cards.ts",
    "old": "Number.parseFloat(env.computed(root, '--bar-h'))",
    "new": "Number.parseFloat('0')",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M85",
    "guard": "no --bar-h is no bar",
    "file": "src/enhance/cards.ts",
    "old": "return Number.isFinite(h) ? h : 0;",
    "new": "return h;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M86",
    "guard": "the natural height is measured afresh",
    "file": "src/enhance/cards.ts",
    "old": "    journal.setStyle(card, 'max-height', null);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M87",
    "guard": "below when the card fits there",
    "file": "src/enhance/cards.ts",
    "old": "const down = natural <= below || below >= above;",
    "new": "const down = below >= above;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M88",
    "guard": "below when there is no less room there",
    "file": "src/enhance/cards.ts",
    "old": "const down = natural <= below || below >= above;",
    "new": "const down = natural <= below;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M89",
    "guard": "the max-height has a floor",
    "file": "src/enhance/cards.ts",
    "old": "String(Math.max(MIN_HEIGHT, Math.min(natural, down ? below : above)))",
    "new": "String(Math.min(natural, down ? below : above))",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M90",
    "guard": "the max-height is at most the natural height",
    "file": "src/enhance/cards.ts",
    "old": "String(Math.max(MIN_HEIGHT, Math.min(natural, down ? below : above)))",
    "new": "String(Math.max(MIN_HEIGHT, down ? below : above))",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M91",
    "guard": "kept EDGE from the left",
    "file": "src/enhance/cards.ts",
    "old": "Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE)",
    "new": "Math.min(r.left - LEAD, w - card.offsetWidth - EDGE)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M92",
    "guard": "kept EDGE from the right",
    "file": "src/enhance/cards.ts",
    "old": "Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE)",
    "new": "Math.max(EDGE, r.left - LEAD)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M93",
    "guard": "GAP below the trigger",
    "file": "src/enhance/cards.ts",
    "old": "const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;",
    "new": "const y = down ? r.bottom : r.top - card.offsetHeight - GAP;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M94",
    "guard": "GAP above the trigger, by the card's height",
    "file": "src/enhance/cards.ts",
    "old": "const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;",
    "new": "const y = down ? r.bottom + GAP : r.top - GAP;",
    "tests": "test/enhance-cards.test.ts"
  }
]
```

## Pointers, focus, taps and keys (L2-T17-M95 to L2-T17-M149)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M95 | a pointerdown that names no pointer is a mouse's | `src/enhance/cards.ts` | `lastPointer = type === '' ? 'mouse' : type;` → `lastPointer = type;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pointerdown that names no pointer is a mouse's" |
| L2-T17-M96 | the pointer is heard on the way down (capture) | `src/enhance/cards.ts` | `    true, ⏎   ); ⏎   journal.listen(root, 'pointerover'` → `    false, ⏎   ); ⏎   journal.listen(root, 'pointerover'` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the pointer is heard before the trigger's own handlers: one that stops the pointerdown does not make a tap a click" |
| L2-T17-M97 | the time of the pointerdown is kept | `src/enhance/cards.ts` | `      lastDown = env.now(); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a tap that focuses the link first (a touch, then focus, then the click) still only previews" |
| L2-T17-M98 | only a mouse hovers | `src/enhance/cards.ts` | `    if (e.pointerType !== 'mouse') return; ⏎     const a = triggerOf(e.target);` → `    const a = triggerOf(e.target);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "shows after the delay, and only for a mouse" |
| L2-T17-M99 | the pointer back on a trigger calls off a pending hide | `src/enhance/cards.ts` | `      hideTimer = stop(hideTimer); ⏎       showTimer = stop(showTimer);` → `      showTimer = stop(showTimer);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "the pointer back on the trigger keeps the card; leaving the card again starts the delay again" |
| L2-T17-M100 | a new hover calls off the pending show | `src/enhance/cards.ts` | `      showTimer = stop(showTimer); ⏎       showTimer = env.timeout(` → `      showTimer = env.timeout(` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a second trigger hovered before the delay is the one shown" |
| L2-T17-M101 | a hover shows after SHOW_DELAY_MS | `src/enhance/cards.ts` | `      }, SHOW_DELAY_MS);` → `      }, 0);` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "shows after the delay, and only for a mouse"; "a second trigger hovered before the delay is the one shown"; "after destroy no timer fires: a pending show or hide is cancelled, and does nothing" |
| L2-T17-M102 | the pointer over the card calls off a pending hide | `src/enhance/cards.ts` | `    if (inCard(elementOf(e.target))) hideTimer = stop(hideTimer); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it" |
| L2-T17-M103 | only a mouse leaving hides | `src/enhance/cards.ts` | `    if (e.pointerType !== 'mouse') return; ⏎     const t = elementOf(e.target);` → `    const t = elementOf(e.target);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "leaving another trigger leaves an open card alone, and a touch pointer leaving hides nothing" |
| L2-T17-M104 | a drag in the full-screen figure keeps the card | `src/enhance/cards.ts` | `    if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return;` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "dragging in the full-screen figure keeps the card on its block (Task 23)" |
| L2-T17-M105 | only a drag keeps it there | `src/enhance/cards.ts` | `if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return;` → `if (t.closest('.fig-overlay') !== null) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "dragging in the full-screen figure keeps the card on its block (Task 23)" |
| L2-T17-M106 | only in the full-screen figure | `src/enhance/cards.ts` | `if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return;` → `if (e.buttons !== 0) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "dragging in the full-screen figure keeps the card on its block (Task 23)" |
| L2-T17-M107 | leaving something that is no trigger and not the card does nothing | `src/enhance/cards.ts` | `    if (from === null) return; ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off" |
| L2-T17-M108 | into the card or back to the trigger keeps it | `src/enhance/cards.ts` | `    if (to !== null && (to === shown \|\| to === card)) return; ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it" |
| L2-T17-M109 | leaving for nowhere before the delay shows nothing (no card is no destination) | `src/enhance/cards.ts` | `if (to !== null && (to === shown \|\| to === card)) return;` → `if (to === shown \|\| to === card) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pointer that leaves before the delay shows nothing, wherever it goes" |
| L2-T17-M110 | leaving a trigger calls off its pending show | `src/enhance/cards.ts` | `    showTimer = stop(showTimer); ⏎     if (from === shown \|\| from === card) hide(false);` → `    if (from === shown \|\| from === card) hide(false);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pointer that leaves before the delay shows nothing, wherever it goes" |
| L2-T17-M111 | leaving another trigger leaves an open card alone | `src/enhance/cards.ts` | `    if (from === shown \|\| from === card) hide(false);` → `    hide(false);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "leaving another trigger leaves an open card alone, and a touch pointer leaving hides nothing" |
| L2-T17-M112 | leaving the card hides it | `src/enhance/cards.ts` | `    if (from === shown \|\| from === card) hide(false);` → `    if (from === shown) hide(false);` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it"; "the pointer back on the trigger keeps the card; leaving the card again starts the delay again" |
| L2-T17-M113 | focus on the trigger shown does not mark a tap | `src/enhance/cards.ts` | `if (a === null \|\| a === shown \|\| a === quiet) return;` → `if (a === null \|\| a === quiet) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "focus reaching the trigger whose card a tap showed leaves the next tap a click" |
| L2-T17-M114 | focus given back shows nothing | `src/enhance/cards.ts` | `if (a === null \|\| a === shown \|\| a === quiet) return;` → `if (a === null \|\| a === shown) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "Escape inside the card closes it and returns the focus to its trigger without opening it again"; "a trigger given the focus back shows its card again once the focus comes back to it later"; "closing the overlay with the focus in the card puts the focus back on the trigger; with it elsewhere, nowhere"; "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M115 | a focus after a mouse is no tap | `src/enhance/cards.ts` | `if (lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS) fresh.add(a);` → `if (env.now() - lastDown < FRESH_MS) fresh.add(a);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a focus after a mouse's pointerdown is no tap: a touch click on its card's trigger goes" |
| L2-T17-M116 | a focus long after the touch is no tap | `src/enhance/cards.ts` | `if (lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS) fresh.add(a);` → `if (lastPointer !== 'mouse') fresh.add(a);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a focus long after the touch is no tap: its click goes" |
| L2-T17-M117 | focus moving with no card shown does nothing | `src/enhance/cards.ts` | `if (shown !== null && (to === null \|\| !(to === shown \|\| inCard(to)))) hide(false);` → `if (to === null \|\| !(to === shown \|\| inCard(to))) hide(false);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off" |
| L2-T17-M118 | focus leaving the page hides it | `src/enhance/cards.ts` | `if (shown !== null && (to === null \|\| !(to === shown \|\| inCard(to)))) hide(false);` → `if (shown !== null && to !== null && !(to === shown \|\| inCard(to))) hide(false);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "focus leaving the page (to nothing) hides it" |
| L2-T17-M119 | focus back on the trigger keeps it | `src/enhance/cards.ts` | `!(to === shown \|\| inCard(to))` → `!inCard(to)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "focus shows at once; focus moving on hides after the delay, and into the card keeps it" |
| L2-T17-M120 | focus into the card keeps it | `src/enhance/cards.ts` | `!(to === shown \|\| inCard(to))` → `!(to === shown)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "focus shows at once; focus moving on hides after the delay, and into the card keeps it" |
| L2-T17-M121 | a click on a diagram block shows its card | `src/enhance/cards.ts` | `      if (a.matches('.dnode')) { ⏎         showFor(a); ⏎         return; ⏎       } ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "a figure: its whole caption"; "dragging in the full-screen figure keeps the card on its block (Task 23)"; "follows the trigger on scroll, and hides once the trigger leaves the window or the document"; "a click on a block shows its card, by any pointer; the block goes nowhere itself" |
| L2-T17-M122 | a click is read by its own pointer first | `src/enhance/cards.ts` | `const type = typeof own === 'string' && own !== '' ? own : lastPointer;` → `const type = lastPointer;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a mouse click goes at once, whatever the last pointer; a click event that names its pointer is read by it" |
| L2-T17-M123 | a click that names no pointer is read by the last pointerdown | `src/enhance/cards.ts` | `const type = typeof own === 'string' && own !== '' ? own : lastPointer;` → `const type = typeof own === 'string' ? own : lastPointer;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a click that names no pointer (a key's) is read by the last pointerdown" |
| L2-T17-M124 | a mouse's click goes at once | `src/enhance/cards.ts` | `if (type !== 'mouse' && (a !== shown \|\| fresh.has(a))) {` → `if (a !== shown \|\| fresh.has(a)) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "a pointerdown that names no pointer is a mouse's"; "a click that names no pointer (a key's) is read by the last pointerdown"; "a mouse click goes at once, whatever the last pointer; a click event that names its pointer is read by it" |
| L2-T17-M125 | the second tap goes | `src/enhance/cards.ts` | `if (type !== 'mouse' && (a !== shown \|\| fresh.has(a))) {` → `if (type !== 'mouse') {` | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes"; "a term: the first tap previews, the second goes to its row"; "a tap that focuses the link first (a touch, then focus, then the click) still only previews"; "a focus long after the touch is no tap: its click goes"; "focus reaching the trigger whose card a tap showed leaves the next tap a click" and 1 more |
| L2-T17-M126 | a tap that focused first still previews | `src/enhance/cards.ts` | `if (type !== 'mouse' && (a !== shown \|\| fresh.has(a))) {` → `if (type !== 'mouse' && a !== shown) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a tap that focuses the link first (a touch, then focus, then the click) still only previews" |
| L2-T17-M127 | a tap that previewed is used up | `src/enhance/cards.ts` | `        fresh.delete(a); ⏎         e.preventDefault();` → `        e.preventDefault();` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a tap that focuses the link first (a touch, then focus, then the click) still only previews" |
| L2-T17-M128 | the first tap goes nowhere | `src/enhance/cards.ts` | `        e.preventDefault(); ⏎         e.stopPropagation(); ⏎         showFor(a);` → `        e.stopPropagation(); ⏎         showFor(a);` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes"; "a tap that focuses the link first (a touch, then focus, then the click) still only previews"; "a mouse click goes at once, whatever the last pointer; a click event that names its pointer is read by it" |
| L2-T17-M129 | the first tap never reaches the page around the root | `src/enhance/cards.ts` | `        e.stopPropagation(); ⏎         showFor(a);` → `        showFor(a);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a first tap never reaches the page around the root" |
| L2-T17-M130 | the tap is heard before the link's own listener (capture) | `src/enhance/cards.ts` | `    true, ⏎   ); ⏎   journal.listen(root, 'keydown'` → `    false, ⏎   ); ⏎   journal.listen(root, 'keydown'` | `test/enhance-cards.test.ts` (`rc=1`, red): 7 failed \| 77 passed (84). "an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes"; "a term: the first tap previews, the second goes to its row"; "a tap that focuses the link first (a touch, then focus, then the click) still only previews"; "a click that names no pointer (a key's) is read by the last pointerdown"; "the pointer is heard before the trigger's own handlers: one that stops the pointerdown does not make a tap a click" and 2 more |
| L2-T17-M131 | a key another handler took is left alone | `src/enhance/cards.ts` | `    if (e.defaultPrevented) return; ⏎     const t = elementOf(e.target);` → `    const t = elementOf(e.target);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a block whose Enter something else took shows nothing" |
| L2-T17-M132 | Enter on a block shows its card | `src/enhance/cards.ts` | `(e.key === 'Enter' \|\| e.key === ' ')` → `(e.key === ' ')` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Enter or Space on a block shows its card and moves into it" |
| L2-T17-M133 | Space on a block shows its card | `src/enhance/cards.ts` | `(e.key === 'Enter' \|\| e.key === ' ')` → `(e.key === 'Enter')` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Enter or Space on a block shows its card and moves into it" |
| L2-T17-M134 | a block's key goes no further | `src/enhance/cards.ts` | `      e.preventDefault(); ⏎       showFor(block);` → `      showFor(block);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Enter or Space on a block shows its card and moves into it" |
| L2-T17-M135 | Enter on a block moves into the card | `src/enhance/cards.ts` | `      all[all.length - 1]?.focus(); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Enter or Space on a block shows its card and moves into it" |
| L2-T17-M136 | only Tab on the trigger enters the card | `src/enhance/cards.ts` | `if (e.key !== 'Tab' \|\| e.shiftKey \|\| e.target !== shown) return;` → `if (e.shiftKey \|\| e.target !== shown) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll"; "Escape on the trigger closes the card, keeps the focus there, and does not open it again"; "Shift+Tab on the trigger, and Tab on a trigger whose card is not open, are the browser's"; "each root has its own card; Escape closes only the root's own" |
| L2-T17-M137 | Shift+Tab on the trigger is the browser's | `src/enhance/cards.ts` | `if (e.key !== 'Tab' \|\| e.shiftKey \|\| e.target !== shown) return;` → `if (e.key !== 'Tab' \|\| e.target !== shown) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Shift+Tab on the trigger, and Tab on a trigger whose card is not open, are the browser's" |
| L2-T17-M138 | only the shown card's trigger enters it | `src/enhance/cards.ts` | `if (e.key !== 'Tab' \|\| e.shiftKey \|\| e.target !== shown) return;` → `if (e.key !== 'Tab' \|\| e.shiftKey) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 3 failed \| 81 passed (84). "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly"; "Shift+Tab on the trigger, and Tab on a trigger whose card is not open, are the browser's"; "a card with links in its body: Tab goes to the first, and out only from the last" |
| L2-T17-M139 | Tab into the card is the card's | `src/enhance/cards.ts` | `    e.preventDefault(); ⏎     first.focus();` → `    first.focus();` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M140 | Escape in the card goes no further | `src/enhance/cards.ts` | `        e.preventDefault(); ⏎         hide(true); ⏎         if (a !== null) quietFocus(a); ⏎        …` → `        hide(true); ⏎         if (a !== null) quietFocus(a); ⏎         return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Escape inside the card closes it and returns the focus to its trigger without opening it again" |
| L2-T17-M141 | Escape in the card hides it | `src/enhance/cards.ts` | `        e.preventDefault(); ⏎         hide(true); ⏎         if (a !== null) quietFocus(a); ⏎        …` → `        e.preventDefault(); ⏎         if (a !== null) quietFocus(a); ⏎         return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "Escape inside the card closes it and returns the focus to its trigger without opening it again"; "a trigger given the focus back shows its card again once the focus comes back to it later" |
| L2-T17-M142 | Escape in the card gives the focus back | `src/enhance/cards.ts` | `        e.preventDefault(); ⏎         hide(true); ⏎         if (a !== null) quietFocus(a); ⏎        …` → `        e.preventDefault(); ⏎         hide(true); ⏎         return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Escape inside the card closes it and returns the focus to its trigger without opening it again" |
| L2-T17-M143 | given back quietly | `src/enhance/cards.ts` | `    quiet = a; ⏎     try {` → `    try {` | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "Escape inside the card closes it and returns the focus to its trigger without opening it again"; "a trigger given the focus back shows its card again once the focus comes back to it later"; "closing the overlay with the focus in the card puts the focus back on the trigger; with it elsewhere, nowhere"; "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M144 | quiet only while the focus is given back | `src/enhance/cards.ts` | `    } finally { ⏎       quiet = null; ⏎     }` → `    } finally { ⏎     }` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a trigger given the focus back shows its card again once the focus comes back to it later" |
| L2-T17-M145 | a key other than Tab in the card is not the card's | `src/enhance/cards.ts` | `      if (e.key !== 'Tab') return; ⏎       const all = stops();` → `      const all = stops();` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a key other than Tab and Escape in the card leaves it open" |
| L2-T17-M146 | Shift+Tab on the first stop goes back to the trigger | `src/enhance/cards.ts` | `if (e.shiftKey && active === all[0]) {` → `if (false) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M147 | Shift+Tab back is the card's | `src/enhance/cards.ts` | `        e.preventDefault(); ⏎         if (a !== null) (a as HTMLElement).focus();` → `        if (a !== null) (a as HTMLElement).focus();` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M148 | Tab on the last stop leaves the card | `src/enhance/cards.ts` | `} else if (!e.shiftKey && active === all[all.length - 1]) {` → `} else if (false) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly" |
| L2-T17-M149 | only from the last stop | `src/enhance/cards.ts` | `} else if (!e.shiftKey && active === all[all.length - 1]) {` → `} else if (!e.shiftKey) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a card with links in its body: Tab goes to the first, and out only from the last" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M95",
    "guard": "a pointerdown that names no pointer is a mouse's",
    "file": "src/enhance/cards.ts",
    "old": "lastPointer = type === '' ? 'mouse' : type;",
    "new": "lastPointer = type;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M96",
    "guard": "the pointer is heard on the way down (capture)",
    "file": "src/enhance/cards.ts",
    "old": "    true,\n  );\n  journal.listen(root, 'pointerover'",
    "new": "    false,\n  );\n  journal.listen(root, 'pointerover'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M97",
    "guard": "the time of the pointerdown is kept",
    "file": "src/enhance/cards.ts",
    "old": "      lastDown = env.now();\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M98",
    "guard": "only a mouse hovers",
    "file": "src/enhance/cards.ts",
    "old": "    if (e.pointerType !== 'mouse') return;\n    const a = triggerOf(e.target);",
    "new": "    const a = triggerOf(e.target);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M99",
    "guard": "the pointer back on a trigger calls off a pending hide",
    "file": "src/enhance/cards.ts",
    "old": "      hideTimer = stop(hideTimer);\n      showTimer = stop(showTimer);",
    "new": "      showTimer = stop(showTimer);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M100",
    "guard": "a new hover calls off the pending show",
    "file": "src/enhance/cards.ts",
    "old": "      showTimer = stop(showTimer);\n      showTimer = env.timeout(",
    "new": "      showTimer = env.timeout(",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M101",
    "guard": "a hover shows after SHOW_DELAY_MS",
    "file": "src/enhance/cards.ts",
    "old": "      }, SHOW_DELAY_MS);",
    "new": "      }, 0);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M102",
    "guard": "the pointer over the card calls off a pending hide",
    "file": "src/enhance/cards.ts",
    "old": "    if (inCard(elementOf(e.target))) hideTimer = stop(hideTimer);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M103",
    "guard": "only a mouse leaving hides",
    "file": "src/enhance/cards.ts",
    "old": "    if (e.pointerType !== 'mouse') return;\n    const t = elementOf(e.target);",
    "new": "    const t = elementOf(e.target);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M104",
    "guard": "a drag in the full-screen figure keeps the card",
    "file": "src/enhance/cards.ts",
    "old": "    if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return;",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M105",
    "guard": "only a drag keeps it there",
    "file": "src/enhance/cards.ts",
    "old": "if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return;",
    "new": "if (t.closest('.fig-overlay') !== null) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M106",
    "guard": "only in the full-screen figure",
    "file": "src/enhance/cards.ts",
    "old": "if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return;",
    "new": "if (e.buttons !== 0) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M107",
    "guard": "leaving something that is no trigger and not the card does nothing",
    "file": "src/enhance/cards.ts",
    "old": "    if (from === null) return;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M108",
    "guard": "into the card or back to the trigger keeps it",
    "file": "src/enhance/cards.ts",
    "old": "    if (to !== null && (to === shown || to === card)) return;\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M109",
    "guard": "leaving for nowhere before the delay shows nothing (no card is no destination)",
    "file": "src/enhance/cards.ts",
    "old": "if (to !== null && (to === shown || to === card)) return;",
    "new": "if (to === shown || to === card) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M110",
    "guard": "leaving a trigger calls off its pending show",
    "file": "src/enhance/cards.ts",
    "old": "    showTimer = stop(showTimer);\n    if (from === shown || from === card) hide(false);",
    "new": "    if (from === shown || from === card) hide(false);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M111",
    "guard": "leaving another trigger leaves an open card alone",
    "file": "src/enhance/cards.ts",
    "old": "    if (from === shown || from === card) hide(false);",
    "new": "    hide(false);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M112",
    "guard": "leaving the card hides it",
    "file": "src/enhance/cards.ts",
    "old": "    if (from === shown || from === card) hide(false);",
    "new": "    if (from === shown) hide(false);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M113",
    "guard": "focus on the trigger shown does not mark a tap",
    "file": "src/enhance/cards.ts",
    "old": "if (a === null || a === shown || a === quiet) return;",
    "new": "if (a === null || a === quiet) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M114",
    "guard": "focus given back shows nothing",
    "file": "src/enhance/cards.ts",
    "old": "if (a === null || a === shown || a === quiet) return;",
    "new": "if (a === null || a === shown) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M115",
    "guard": "a focus after a mouse is no tap",
    "file": "src/enhance/cards.ts",
    "old": "if (lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS) fresh.add(a);",
    "new": "if (env.now() - lastDown < FRESH_MS) fresh.add(a);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M116",
    "guard": "a focus long after the touch is no tap",
    "file": "src/enhance/cards.ts",
    "old": "if (lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS) fresh.add(a);",
    "new": "if (lastPointer !== 'mouse') fresh.add(a);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M117",
    "guard": "focus moving with no card shown does nothing",
    "file": "src/enhance/cards.ts",
    "old": "if (shown !== null && (to === null || !(to === shown || inCard(to)))) hide(false);",
    "new": "if (to === null || !(to === shown || inCard(to))) hide(false);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M118",
    "guard": "focus leaving the page hides it",
    "file": "src/enhance/cards.ts",
    "old": "if (shown !== null && (to === null || !(to === shown || inCard(to)))) hide(false);",
    "new": "if (shown !== null && to !== null && !(to === shown || inCard(to))) hide(false);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M119",
    "guard": "focus back on the trigger keeps it",
    "file": "src/enhance/cards.ts",
    "old": "!(to === shown || inCard(to))",
    "new": "!inCard(to)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M120",
    "guard": "focus into the card keeps it",
    "file": "src/enhance/cards.ts",
    "old": "!(to === shown || inCard(to))",
    "new": "!(to === shown)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M121",
    "guard": "a click on a diagram block shows its card",
    "file": "src/enhance/cards.ts",
    "old": "      if (a.matches('.dnode')) {\n        showFor(a);\n        return;\n      }\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M122",
    "guard": "a click is read by its own pointer first",
    "file": "src/enhance/cards.ts",
    "old": "const type = typeof own === 'string' && own !== '' ? own : lastPointer;",
    "new": "const type = lastPointer;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M123",
    "guard": "a click that names no pointer is read by the last pointerdown",
    "file": "src/enhance/cards.ts",
    "old": "const type = typeof own === 'string' && own !== '' ? own : lastPointer;",
    "new": "const type = typeof own === 'string' ? own : lastPointer;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M124",
    "guard": "a mouse's click goes at once",
    "file": "src/enhance/cards.ts",
    "old": "if (type !== 'mouse' && (a !== shown || fresh.has(a))) {",
    "new": "if (a !== shown || fresh.has(a)) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M125",
    "guard": "the second tap goes",
    "file": "src/enhance/cards.ts",
    "old": "if (type !== 'mouse' && (a !== shown || fresh.has(a))) {",
    "new": "if (type !== 'mouse') {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M126",
    "guard": "a tap that focused first still previews",
    "file": "src/enhance/cards.ts",
    "old": "if (type !== 'mouse' && (a !== shown || fresh.has(a))) {",
    "new": "if (type !== 'mouse' && a !== shown) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M127",
    "guard": "a tap that previewed is used up",
    "file": "src/enhance/cards.ts",
    "old": "        fresh.delete(a);\n        e.preventDefault();",
    "new": "        e.preventDefault();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M128",
    "guard": "the first tap goes nowhere",
    "file": "src/enhance/cards.ts",
    "old": "        e.preventDefault();\n        e.stopPropagation();\n        showFor(a);",
    "new": "        e.stopPropagation();\n        showFor(a);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M129",
    "guard": "the first tap never reaches the page around the root",
    "file": "src/enhance/cards.ts",
    "old": "        e.stopPropagation();\n        showFor(a);",
    "new": "        showFor(a);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M130",
    "guard": "the tap is heard before the link's own listener (capture)",
    "file": "src/enhance/cards.ts",
    "old": "    true,\n  );\n  journal.listen(root, 'keydown'",
    "new": "    false,\n  );\n  journal.listen(root, 'keydown'",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M131",
    "guard": "a key another handler took is left alone",
    "file": "src/enhance/cards.ts",
    "old": "    if (e.defaultPrevented) return;\n    const t = elementOf(e.target);",
    "new": "    const t = elementOf(e.target);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M132",
    "guard": "Enter on a block shows its card",
    "file": "src/enhance/cards.ts",
    "old": "(e.key === 'Enter' || e.key === ' ')",
    "new": "(e.key === ' ')",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M133",
    "guard": "Space on a block shows its card",
    "file": "src/enhance/cards.ts",
    "old": "(e.key === 'Enter' || e.key === ' ')",
    "new": "(e.key === 'Enter')",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M134",
    "guard": "a block's key goes no further",
    "file": "src/enhance/cards.ts",
    "old": "      e.preventDefault();\n      showFor(block);",
    "new": "      showFor(block);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M135",
    "guard": "Enter on a block moves into the card",
    "file": "src/enhance/cards.ts",
    "old": "      all[all.length - 1]?.focus();\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M136",
    "guard": "only Tab on the trigger enters the card",
    "file": "src/enhance/cards.ts",
    "old": "if (e.key !== 'Tab' || e.shiftKey || e.target !== shown) return;",
    "new": "if (e.shiftKey || e.target !== shown) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M137",
    "guard": "Shift+Tab on the trigger is the browser's",
    "file": "src/enhance/cards.ts",
    "old": "if (e.key !== 'Tab' || e.shiftKey || e.target !== shown) return;",
    "new": "if (e.key !== 'Tab' || e.target !== shown) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M138",
    "guard": "only the shown card's trigger enters it",
    "file": "src/enhance/cards.ts",
    "old": "if (e.key !== 'Tab' || e.shiftKey || e.target !== shown) return;",
    "new": "if (e.key !== 'Tab' || e.shiftKey) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M139",
    "guard": "Tab into the card is the card's",
    "file": "src/enhance/cards.ts",
    "old": "    e.preventDefault();\n    first.focus();",
    "new": "    first.focus();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M140",
    "guard": "Escape in the card goes no further",
    "file": "src/enhance/cards.ts",
    "old": "        e.preventDefault();\n        hide(true);\n        if (a !== null) quietFocus(a);\n        return;",
    "new": "        hide(true);\n        if (a !== null) quietFocus(a);\n        return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M141",
    "guard": "Escape in the card hides it",
    "file": "src/enhance/cards.ts",
    "old": "        e.preventDefault();\n        hide(true);\n        if (a !== null) quietFocus(a);\n        return;",
    "new": "        e.preventDefault();\n        if (a !== null) quietFocus(a);\n        return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M142",
    "guard": "Escape in the card gives the focus back",
    "file": "src/enhance/cards.ts",
    "old": "        e.preventDefault();\n        hide(true);\n        if (a !== null) quietFocus(a);\n        return;",
    "new": "        e.preventDefault();\n        hide(true);\n        return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M143",
    "guard": "given back quietly",
    "file": "src/enhance/cards.ts",
    "old": "    quiet = a;\n    try {",
    "new": "    try {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M144",
    "guard": "quiet only while the focus is given back",
    "file": "src/enhance/cards.ts",
    "old": "    } finally {\n      quiet = null;\n    }",
    "new": "    } finally {\n    }",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M145",
    "guard": "a key other than Tab in the card is not the card's",
    "file": "src/enhance/cards.ts",
    "old": "      if (e.key !== 'Tab') return;\n      const all = stops();",
    "new": "      const all = stops();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M146",
    "guard": "Shift+Tab on the first stop goes back to the trigger",
    "file": "src/enhance/cards.ts",
    "old": "if (e.shiftKey && active === all[0]) {",
    "new": "if (false) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M147",
    "guard": "Shift+Tab back is the card's",
    "file": "src/enhance/cards.ts",
    "old": "        e.preventDefault();\n        if (a !== null) (a as HTMLElement).focus();",
    "new": "        if (a !== null) (a as HTMLElement).focus();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M148",
    "guard": "Tab on the last stop leaves the card",
    "file": "src/enhance/cards.ts",
    "old": "} else if (!e.shiftKey && active === all[all.length - 1]) {",
    "new": "} else if (false) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M149",
    "guard": "only from the last stop",
    "file": "src/enhance/cards.ts",
    "old": "} else if (!e.shiftKey && active === all[all.length - 1]) {",
    "new": "} else if (!e.shiftKey) {",
    "tests": "test/enhance-cards.test.ts"
  }
]
```

## The card's link, the overlay and what closes the card (L2-T17-M150 to L2-T17-M169)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M150 | the card's link goes, and no further | `src/enhance/cards.ts` | `        e.preventDefault(); ⏎         nav.goTo(goal` → `        nav.goTo(goal` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a plain click goes to the definition through nav: hidden, focused, the host told"; "a term's link goes to its row" |
| L2-T17-M151 | the card's link goes to the target | `src/enhance/cards.ts` | `        nav.goTo(goal, { push: true }); // going there reveals it, which hides the card ('reveal') ⏎…` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a plain click goes to the definition through nav: hidden, focused, the host told"; "a term's link goes to its row" |
| L2-T17-M152 | a click another handler took is left alone | `src/enhance/cards.ts` | `!e.defaultPrevented && e.button === 0` → `e.button === 0` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M153 | only the main button | `src/enhance/cards.ts` | `!e.defaultPrevented && e.button === 0` → `!e.defaultPrevented` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M154 | Ctrl leaves it to the browser | `src/enhance/cards.ts` | `!(e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey)` → `!(e.metaKey \|\| e.shiftKey \|\| e.altKey)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M155 | Cmd leaves it to the browser | `src/enhance/cards.ts` | `!(e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey)` → `!(e.ctrlKey \|\| e.shiftKey \|\| e.altKey)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M156 | Shift leaves it to the browser | `src/enhance/cards.ts` | `!(e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey)` → `!(e.ctrlKey \|\| e.metaKey \|\| e.altKey)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M157 | Alt leaves it to the browser | `src/enhance/cards.ts` | `!(e.ctrlKey \|\| e.metaKey \|\| e.shiftKey \|\| e.altKey)` → `!(e.ctrlKey \|\| e.metaKey \|\| e.shiftKey)` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M158 | a link in the card to a place in the page closes it | `src/enhance/cards.ts` | `if (link !== null && (link.getAttribute('href') ?? '').startsWith('#')) {` → `if (false) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a link inside the card to a place in the page closes it after the click" |
| L2-T17-M159 | only a link to a place in the page | `src/enhance/cards.ts` | `if (link !== null && (link.getAttribute('href') ?? '').startsWith('#')) {` → `if (link !== null) {` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a link inside the card to another document does not close it" |
| L2-T17-M160 | once the click is done | `src/enhance/cards.ts` | `        env.timeout(() => { ⏎           hide(true); ⏎         }, 0);` → `        hide(true);` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 82 passed (84). "a link inside the card to a place in the page closes it after the click"; "a modified click, another button, or one already handled, is not the card's" |
| L2-T17-M161 | the overlay is open while the card shows | `src/enhance/cards.ts` | `isOpen: () => shown !== null,` → `isOpen: () => false,` | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll"; "Escape on the trigger closes the card, keeps the focus there, and does not open it again"; "Escape with the focus elsewhere closes the card and moves no focus"; "closing the overlay with the focus in the card puts the focus back on the trigger; with it elsewhere, nowhere"; "the card is the overlay "card", last in the Escape order, and no dialog" and 1 more |
| L2-T17-M162 | closing the overlay hides the card | `src/enhance/cards.ts` | `        hide(true); ⏎         if (a !== null && back) quietFocus(a);` → `        if (a !== null && back) quietFocus(a);` | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll"; "Escape on the trigger closes the card, keeps the focus there, and does not open it again"; "Escape with the focus elsewhere closes the card and moves no focus"; "closing the overlay with the focus in the card puts the focus back on the trigger; with it elsewhere, nowhere"; "the card is the overlay "card", last in the Escape order, and no dialog" and 1 more |
| L2-T17-M163 | closing the overlay gives the focus back from the card | `src/enhance/cards.ts` | `        if (a !== null && back) quietFocus(a); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "closing the overlay with the focus in the card puts the focus back on the trigger; with it elsewhere, nowhere" |
| L2-T17-M164 | a pointer down with no card shown does nothing | `src/enhance/cards.ts` | `    if (shown === null) return; ⏎     const t = elementOf(event.target);` → `    const t = elementOf(event.target);` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off" |
| L2-T17-M165 | a pointer down on the card keeps it | `src/enhance/cards.ts` | `if (inCard(t) \|\| triggerOf(t) !== null) return;` → `if (triggerOf(t) !== null) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "a pointer down outside the card and the triggers hides it; on the card or a trigger it does not" |
| L2-T17-M166 | a pointer down on a trigger keeps it | `src/enhance/cards.ts` | `if (inCard(t) \|\| triggerOf(t) !== null) return;` → `if (inCard(t)) return;` | `test/enhance-cards.test.ts` (`rc=1`, red): 5 failed \| 79 passed (84). "an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes"; "a term: the first tap previews, the second goes to its row"; "a tap that focuses the link first (a touch, then focus, then the click) still only previews"; "focus reaching the trigger whose card a tap showed leaves the next tap a click"; "a pointer down outside the card and the triggers hides it; on the card or a trigger it does not" |
| L2-T17-M167 | another root's trigger is no trigger here | `src/enhance/cards.ts` | `return a !== null && root.contains(a) ? a : null;` → `return a;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 83 passed (84). "each root has its own card; Escape closes only the root's own" |
| L2-T17-M168 | going anywhere hides it | `src/enhance/cards.ts` | `  ctx.events.on('reveal', () => { ⏎     hide(true); ⏎   }); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 6 failed \| 78 passed (84). "a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off"; "an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes"; "a term: the first tap previews, the second goes to its row"; "focus reaching the trigger whose card a tap showed leaves the next tap a click"; "going anywhere closes it: a link the reader follows, the card's own link, the keys" and 1 more |
| L2-T17-M169 | show() finds the instance's card | `src/enhance/cards.ts` | `  states.set(ctx, { show: showFor }); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 4 failed \| 80 passed (84). "show() answers false for a trigger out of the window, and calls off a pending hide"; "data-term names a term first; an empty one leaves data-ref to name an ID"; "show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest"; "show() of another root's context never reaches this root, and does nothing once destroyed" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M150",
    "guard": "the card's link goes, and no further",
    "file": "src/enhance/cards.ts",
    "old": "        e.preventDefault();\n        nav.goTo(goal",
    "new": "        nav.goTo(goal",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M151",
    "guard": "the card's link goes to the target",
    "file": "src/enhance/cards.ts",
    "old": "        nav.goTo(goal, { push: true }); // going there reveals it, which hides the card ('reveal')\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M152",
    "guard": "a click another handler took is left alone",
    "file": "src/enhance/cards.ts",
    "old": "!e.defaultPrevented && e.button === 0",
    "new": "e.button === 0",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M153",
    "guard": "only the main button",
    "file": "src/enhance/cards.ts",
    "old": "!e.defaultPrevented && e.button === 0",
    "new": "!e.defaultPrevented",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M154",
    "guard": "Ctrl leaves it to the browser",
    "file": "src/enhance/cards.ts",
    "old": "!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)",
    "new": "!(e.metaKey || e.shiftKey || e.altKey)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M155",
    "guard": "Cmd leaves it to the browser",
    "file": "src/enhance/cards.ts",
    "old": "!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)",
    "new": "!(e.ctrlKey || e.shiftKey || e.altKey)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M156",
    "guard": "Shift leaves it to the browser",
    "file": "src/enhance/cards.ts",
    "old": "!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)",
    "new": "!(e.ctrlKey || e.metaKey || e.altKey)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M157",
    "guard": "Alt leaves it to the browser",
    "file": "src/enhance/cards.ts",
    "old": "!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)",
    "new": "!(e.ctrlKey || e.metaKey || e.shiftKey)",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M158",
    "guard": "a link in the card to a place in the page closes it",
    "file": "src/enhance/cards.ts",
    "old": "if (link !== null && (link.getAttribute('href') ?? '').startsWith('#')) {",
    "new": "if (false) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M159",
    "guard": "only a link to a place in the page",
    "file": "src/enhance/cards.ts",
    "old": "if (link !== null && (link.getAttribute('href') ?? '').startsWith('#')) {",
    "new": "if (link !== null) {",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M160",
    "guard": "once the click is done",
    "file": "src/enhance/cards.ts",
    "old": "        env.timeout(() => {\n          hide(true);\n        }, 0);",
    "new": "        hide(true);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M161",
    "guard": "the overlay is open while the card shows",
    "file": "src/enhance/cards.ts",
    "old": "isOpen: () => shown !== null,",
    "new": "isOpen: () => false,",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M162",
    "guard": "closing the overlay hides the card",
    "file": "src/enhance/cards.ts",
    "old": "        hide(true);\n        if (a !== null && back) quietFocus(a);",
    "new": "        if (a !== null && back) quietFocus(a);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M163",
    "guard": "closing the overlay gives the focus back from the card",
    "file": "src/enhance/cards.ts",
    "old": "        if (a !== null && back) quietFocus(a);\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M164",
    "guard": "a pointer down with no card shown does nothing",
    "file": "src/enhance/cards.ts",
    "old": "    if (shown === null) return;\n    const t = elementOf(event.target);",
    "new": "    const t = elementOf(event.target);",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M165",
    "guard": "a pointer down on the card keeps it",
    "file": "src/enhance/cards.ts",
    "old": "if (inCard(t) || triggerOf(t) !== null) return;",
    "new": "if (triggerOf(t) !== null) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M166",
    "guard": "a pointer down on a trigger keeps it",
    "file": "src/enhance/cards.ts",
    "old": "if (inCard(t) || triggerOf(t) !== null) return;",
    "new": "if (inCard(t)) return;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M167",
    "guard": "another root's trigger is no trigger here",
    "file": "src/enhance/cards.ts",
    "old": "return a !== null && root.contains(a) ? a : null;",
    "new": "return a;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M168",
    "guard": "going anywhere hides it",
    "file": "src/enhance/cards.ts",
    "old": "  ctx.events.on('reveal', () => {\n    hide(true);\n  });\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M169",
    "guard": "show() finds the instance's card",
    "file": "src/enhance/cards.ts",
    "old": "  states.set(ctx, { show: showFor });\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  }
]
```

## In a real browser (L2-T17-M170 to L2-T17-M175)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M170 | GAP below the trigger (Chromium) | `src/enhance/cards.ts` | `const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;` → `const y = down ? r.bottom : r.top - card.offsetHeight - GAP;` | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 4 passed \| 5 skipped (10). "below the trigger when the card fits there, its left from the trigger's, never over it" |
| L2-T17-M171 | above when the room below is short (Chromium) | `src/enhance/cards.ts` | `const down = natural <= below \|\| below >= above;` → `const down = true;` | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 4 passed \| 5 skipped (10). "above the trigger, under the bar, when the room below is short; never over it" |
| L2-T17-M172 | kept EDGE from the right (Chromium) | `src/enhance/cards.ts` | `Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE)` → `Math.max(EDGE, r.left - LEAD)` | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 4 passed \| 5 skipped (10). "clamped to the window on a phone: 12 px from each side, never over the trigger" |
| L2-T17-M173 | the card follows the scroll (Chromium) | `src/enhance/cards.ts` | `      following ??= env.onScroll(() => { ⏎         place(); ⏎       }); ⏎ ` → (deleted) | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 4 passed \| 5 skipped (10). "follows the trigger on scroll, and hides once the trigger has left the window" |
| L2-T17-M174 | a hover shows after the delay (Chromium) | `src/enhance/cards.ts` | `      }, SHOW_DELAY_MS);` → `      }, 60_000);` | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 4 passed \| 5 skipped (10). "a mouse resting on a trigger shows its card after the delay; leaving it hides the card" |
| L2-T17-M175 | leaving the trigger hides it (Chromium) | `src/enhance/cards.ts` | `    if (from === shown \|\| from === card) hide(false);` → (deleted) | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 4 passed \| 5 skipped (10). "a mouse resting on a trigger shows its card after the delay; leaving it hides the card" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M170",
    "guard": "GAP below the trigger (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;",
    "new": "const y = down ? r.bottom : r.top - card.offsetHeight - GAP;",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M171",
    "guard": "above when the room below is short (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "const down = natural <= below || below >= above;",
    "new": "const down = true;",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M172",
    "guard": "kept EDGE from the right (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE)",
    "new": "Math.max(EDGE, r.left - LEAD)",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M173",
    "guard": "the card follows the scroll (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "      following ??= env.onScroll(() => {\n        place();\n      });\n",
    "new": "",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M174",
    "guard": "a hover shows after the delay (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "      }, SHOW_DELAY_MS);",
    "new": "      }, 60_000);",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M175",
    "guard": "leaving the trigger hides it (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "    if (from === shown || from === card) hide(false);",
    "new": "",
    "tests": "test/browser/cards.test.ts"
  }
]
```

## The Level 2 case (cards/xrefs), on xrefs.ts (L2-T17-M176 to L2-T17-M178)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M176 | the first mention of an ID per block links (cards/xrefs) | `src/enhance/xrefs.ts` | `if (entry === undefined \|\| seen.has(id)) continue;` → `if (entry === undefined) continue;` | `test/browser/layout-corpus.test.ts -t 'cards/xrefs'` (`rc=1`, red): 1 failed \| 44 skipped (45). "cards/xrefs" |
| L2-T17-M177 | a mention in its own row stays text (cards/xrefs) | `src/enhance/xrefs.ts` | `        if (entry.target.contains(text)) continue; ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts -t 'cards/xrefs'` (`rc=1`, red): 1 failed \| 44 skipped (45). "cards/xrefs" |
| L2-T17-M178 | a qualifier makes a mention another document's (cards/xrefs) | `src/enhance/xrefs.ts` | `        if (vocab.qualifier.test(s.slice(Math.max(0, m.index - reach), m.index))) continue; ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts -t 'cards/xrefs'` (`rc=1`, red): 1 failed \| 44 skipped (45). "cards/xrefs" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M176",
    "guard": "the first mention of an ID per block links (cards/xrefs)",
    "file": "src/enhance/xrefs.ts",
    "old": "if (entry === undefined || seen.has(id)) continue;",
    "new": "if (entry === undefined) continue;",
    "tests": "test/browser/layout-corpus.test.ts -t 'cards/xrefs'"
  },
  {
    "id": "L2-T17-M177",
    "guard": "a mention in its own row stays text (cards/xrefs)",
    "file": "src/enhance/xrefs.ts",
    "old": "        if (entry.target.contains(text)) continue;\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts -t 'cards/xrefs'"
  },
  {
    "id": "L2-T17-M178",
    "guard": "a qualifier makes a mention another document's (cards/xrefs)",
    "file": "src/enhance/xrefs.ts",
    "old": "        if (vocab.qualifier.test(s.slice(Math.max(0, m.index - reach), m.index))) continue;\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts -t 'cards/xrefs'"
  }
]
```

## Fix round 1, after the review (L2-T17-M179 to L2-T17-M196)

Measured 2026-10-20 with the same method and `DOCREADER_BROWSERS=chromium`, one row at a time: L2-T17-M193 and
L2-T17-M196 at commit `b0dffed`, the rest at `2ec4907` (the two commits differ only in `scrub()`'s chrome mark and its
comment). All 18 are red (`rc=1`). The checkout read the same before and after each batch (`git status --porcelain`,
`HEAD` and the hash of `git diff` unchanged). The jsdom file now has 91 cases; the browser file has six per browser.

What the round changed, and the rows it supersedes:
- **A tap's click.** In the pinned Playwright WebKit, the click after a touch tap is a PointerEvent that names
  `'mouse'`, so reading the click's own `pointerType` first (the reference's order) made the first tap go. A click
  within `FRESH_MS` of a pointerdown that was not a mouse's is now that pointer's, whatever it names; past that, the
  click's own word, or the last pointerdown's when it names none. A click with `detail` 0 (a key's) goes. Rows M179 to
  M184 replace L2-T17-M122 and L2-T17-M123, whose `old` text is gone.
- **Focus.** A press on the card (its text takes no focus) keeps the card when the focus leaves for nothing, until the
  card hides (M185 to M188). The focus back on the trigger shown calls off a pending hide (M189); M190 replaces
  L2-T17-M113.
- **A block's key.** Enter or Space on a block that shows no card leaves the key and the focus alone (M191); M192
  replaces L2-T17-M134.
- **The chrome mark.** `scrub()` keeps `CHROME_ATTR`'s value as a literal, because the CSP wall allows a name in a
  variable only in `journal.ts`. The content case reads `CHROME_ATTR`, so a drift goes red (M196). M193 is L2-T17-M14
  measured again.
- **max-height in a browser** (M194, M195): the browser cases now assert it, and a new case shows it capping a card.

The real-browser proof of the tap needs a touch screen in the context (`hasTouch`), which the harness (Task 6's file)
does not offer, so no tracked case taps and no row runs in a browser for it. A scratch copy with `hasTouch` added
showed, in both Chromium and the pinned WebKit image: the first tap previews and the second goes; Enter after a tap
goes at once (its click has `detail` 0); a press on the card's text keeps it.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T17-M179 | a tap's click is the tap's pointer's, whatever it names (WebKit's 'mouse') | `src/enhance/cards.ts` | `const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;` → `const type = typeof own === 'string' && own !== '' ? own : lastPointer;` | `test/enhance-cards.test.ts` (`rc=1`, red): 8 failed \| 83 passed (91). "an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes"; "a term: the first tap previews, the second goes to its row"; "the pointer is heard before the trigger's own handlers: one that stops the pointerdown does not make a tap a click"; "focus reaching the trigger whose card a tap showed leaves the next tap a click"; "a first tap never reaches the page around the root" |
| L2-T17-M180 | a tap lasts FRESH_MS | `src/enhance/cards.ts` | `const tapping = (): boolean => lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS;` → `const tapping = (): boolean => lastPointer !== 'mouse';` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 89 passed (91). "a focus long after the touch is no tap: its click goes"; "a click within FRESH_MS of a touch is the touch's, whatever it names; later, its own word wins" |
| L2-T17-M181 | a mouse's pointerdown starts no tap | `src/enhance/cards.ts` | `const tapping = (): boolean => lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS;` → `const tapping = (): boolean => env.now() - lastDown < FRESH_MS;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a mouse click goes at once; a click that names touch after a mouse's pointerdown is read by its own word" |
| L2-T17-M182 | past a tap, the click's own word is read | `src/enhance/cards.ts` | `const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;` → `const type = tapping() ? lastPointer : lastPointer;` | `test/enhance-cards.test.ts` (`rc=1`, red): 2 failed \| 89 passed (91). "a mouse click goes at once; a click that names touch after a mouse's pointerdown is read by its own word"; "a click within FRESH_MS of a touch is the touch's, whatever it names; later, its own word wins" |
| L2-T17-M183 | past a tap, a click that names none is read by the last pointerdown | `src/enhance/cards.ts` | `const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;` → `const type = tapping() ? lastPointer : typeof own === 'string' ? own : lastPointer;` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a pointer's click that names no pointer, long after its pointerdown, is read by that pointerdown" |
| L2-T17-M184 | a key's click (detail 0) goes | `src/enhance/cards.ts` | `      if (e.detail === 0) return; // a key's click (or a script's): it goes ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a key's click (detail 0) goes at once, however lately a touch came down" |
| L2-T17-M185 | a press on the card keeps it when the focus leaves for nothing | `src/enhance/cards.ts` | `    if (to === null && pressedCard) return; // a press on the card's text, which takes no focus ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a press on the card's text keeps it, though the focus leaves for nothing; the press is forgotten once it hides" |
| L2-T17-M186 | a pointerdown on the card is a press on the card | `src/enhance/cards.ts` | `      pressedCard = inCard(elementOf(event.target)); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a press on the card's text keeps it, though the focus leaves for nothing; the press is forgotten once it hides" |
| L2-T17-M187 | a pointerdown elsewhere is no press on the card | `src/enhance/cards.ts` | `      pressedCard = inCard(elementOf(event.target)); ⏎ ` → `      pressedCard = true; ⏎ ` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a press on the card's text keeps it, though the focus leaves for nothing; the press is forgotten once it hides" |
| L2-T17-M188 | the press is forgotten once the card hides | `src/enhance/cards.ts` | `      shown = null; ⏎       pressedCard = false; ⏎ ` → `      shown = null; ⏎ ` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a press on the card's text keeps it, though the focus leaves for nothing; the press is forgotten once it hides" |
| L2-T17-M189 | the focus back on the trigger shown calls off a pending hide | `src/enhance/cards.ts` | `      hideTimer = stop(hideTimer); // the focus came back within the delay ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "the focus back on the trigger shown within the delay keeps its card" |
| L2-T17-M190 | focus on the trigger shown neither shows again nor marks a tap | `src/enhance/cards.ts` | `      hideTimer = stop(hideTimer); // the focus came back within the delay ⏎       return; ⏎ ` → `      hideTimer = stop(hideTimer); // the focus came back within the delay ⏎ ` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "focus reaching the trigger whose card a tap showed leaves the next tap a click" |
| L2-T17-M191 | a block that shows no card leaves the key and the focus alone | `src/enhance/cards.ts` | `      if (!showFor(block)) return; // a block that shows no card leaves the key and the focus alone ⏎ ` → `      showFor(block); ⏎ ` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "Enter or Space on a block that shows no card leaves the key and the focus alone, whatever card is open" |
| L2-T17-M192 | a block's key goes no further once its card shows | `src/enhance/cards.ts` | `      e.preventDefault(); ⏎       const all = stops();` → `      const all = stops();` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "Enter or Space on a block shows its card and moves into it" |
| L2-T17-M193 | every copied element is chrome | `src/enhance/cards.ts` | `    el.setAttribute('data-docreader-chrome', ''); ⏎ ` → (deleted) | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |
| L2-T17-M194 | the max-height is at most the room on the card's side (Chromium) | `src/enhance/cards.ts` | `Math.min(natural, down ? below : above)` → `natural` | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 5 passed \| 6 skipped (12). "the max-height caps a card taller than the room on its side: it ends ROOM above the window's bottom, less GAP" |
| L2-T17-M195 | the max-height is at most the natural height (Chromium) | `src/enhance/cards.ts` | `Math.min(natural, down ? below : above)` → `(down ? below : above)` | `test/browser/cards.test.ts` (`rc=1`, red): 1 failed \| 5 passed \| 6 skipped (12). "below the trigger when the card fits there, its left from the trigger's, never over it" |
| L2-T17-M196 | the literal mark is CHROME_ATTR's value: a drift goes red | `src/enhance/cards.ts` | `    el.setAttribute('data-docreader-chrome', ''); ⏎ ` → `    el.setAttribute('data-docreader-chromed', ''); ⏎ ` | `test/enhance-cards.test.ts` (`rc=1`, red): 1 failed \| 90 passed (91). "a clone drops ids, form controls and render()'s line marks, turns links of the layout into text, and is chrome" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T17-M179",
    "guard": "a tap's click is the tap's pointer's, whatever it names (WebKit's 'mouse')",
    "file": "src/enhance/cards.ts",
    "old": "const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;",
    "new": "const type = typeof own === 'string' && own !== '' ? own : lastPointer;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M180",
    "guard": "a tap lasts FRESH_MS",
    "file": "src/enhance/cards.ts",
    "old": "const tapping = (): boolean => lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS;",
    "new": "const tapping = (): boolean => lastPointer !== 'mouse';",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M181",
    "guard": "a mouse's pointerdown starts no tap",
    "file": "src/enhance/cards.ts",
    "old": "const tapping = (): boolean => lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS;",
    "new": "const tapping = (): boolean => env.now() - lastDown < FRESH_MS;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M182",
    "guard": "past a tap, the click's own word is read",
    "file": "src/enhance/cards.ts",
    "old": "const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;",
    "new": "const type = tapping() ? lastPointer : lastPointer;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M183",
    "guard": "past a tap, a click that names none is read by the last pointerdown",
    "file": "src/enhance/cards.ts",
    "old": "const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;",
    "new": "const type = tapping() ? lastPointer : typeof own === 'string' ? own : lastPointer;",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M184",
    "guard": "a key's click (detail 0) goes",
    "file": "src/enhance/cards.ts",
    "old": "      if (e.detail === 0) return; // a key's click (or a script's): it goes\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M185",
    "guard": "a press on the card keeps it when the focus leaves for nothing",
    "file": "src/enhance/cards.ts",
    "old": "    if (to === null && pressedCard) return; // a press on the card's text, which takes no focus\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M186",
    "guard": "a pointerdown on the card is a press on the card",
    "file": "src/enhance/cards.ts",
    "old": "      pressedCard = inCard(elementOf(event.target));\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M187",
    "guard": "a pointerdown elsewhere is no press on the card",
    "file": "src/enhance/cards.ts",
    "old": "      pressedCard = inCard(elementOf(event.target));\n",
    "new": "      pressedCard = true;\n",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M188",
    "guard": "the press is forgotten once the card hides",
    "file": "src/enhance/cards.ts",
    "old": "      shown = null;\n      pressedCard = false;\n",
    "new": "      shown = null;\n",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M189",
    "guard": "the focus back on the trigger shown calls off a pending hide",
    "file": "src/enhance/cards.ts",
    "old": "      hideTimer = stop(hideTimer); // the focus came back within the delay\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M190",
    "guard": "focus on the trigger shown neither shows again nor marks a tap",
    "file": "src/enhance/cards.ts",
    "old": "      hideTimer = stop(hideTimer); // the focus came back within the delay\n      return;\n",
    "new": "      hideTimer = stop(hideTimer); // the focus came back within the delay\n",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M191",
    "guard": "a block that shows no card leaves the key and the focus alone",
    "file": "src/enhance/cards.ts",
    "old": "      if (!showFor(block)) return; // a block that shows no card leaves the key and the focus alone\n",
    "new": "      showFor(block);\n",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M192",
    "guard": "a block's key goes no further once its card shows",
    "file": "src/enhance/cards.ts",
    "old": "      e.preventDefault();\n      const all = stops();",
    "new": "      const all = stops();",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M193",
    "guard": "every copied element is chrome",
    "file": "src/enhance/cards.ts",
    "old": "    el.setAttribute('data-docreader-chrome', '');\n",
    "new": "",
    "tests": "test/enhance-cards.test.ts"
  },
  {
    "id": "L2-T17-M194",
    "guard": "the max-height is at most the room on the card's side (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "Math.min(natural, down ? below : above)",
    "new": "natural",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M195",
    "guard": "the max-height is at most the natural height (Chromium)",
    "file": "src/enhance/cards.ts",
    "old": "Math.min(natural, down ? below : above)",
    "new": "(down ? below : above)",
    "tests": "test/browser/cards.test.ts"
  },
  {
    "id": "L2-T17-M196",
    "guard": "the literal mark is CHROME_ATTR's value: a drift goes red",
    "file": "src/enhance/cards.ts",
    "old": "    el.setAttribute('data-docreader-chrome', '');\n",
    "new": "    el.setAttribute('data-docreader-chromed', '');\n",
    "tests": "test/enhance-cards.test.ts"
  }
]
```
