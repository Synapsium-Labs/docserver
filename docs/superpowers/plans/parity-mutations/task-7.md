# Parity Task 7: mutation rows (print mode of `render` and its stylesheet)

Each row was measured in place: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json`, then the file restored from the saved bytes and its sha256 compared (each matched). Rows P7a to P7h are the plan's; P7i to P7al are this task's own guards. P7i is the plan fact's gate (departure ccrc D-8868: print follows the screen's gate, a plan of 20 steps or more): it drops the gate from print alone, and goes red through the agreement assertion. P7j is B10's guarantee (a raw tag in the source stays text). Every row exited 1 and every failing test failed with an assertion; none went red through a load failure. No file measured here is an input of the frame build, so the frame was not rebuilt for any row. The sha256 of each file as restored: `assets/print.css` `2ba6cfdc58eaf2e5bced8b767eb85fb3255bcd1c9a23ee1e62ee5add4bfb6113`, `conformance/print/vocabulary.json` `fc5fae3357b1807a589a5f9f502dd487ac0960b5b2f4a20e959e20292494f068`, `src/render/print/boxes.ts` `29f5084cde4f137ee3cbc9412af1680811b14e67cd58660628b4b077c9c3add4`, `src/render/print/index.ts` `80523df599d7842815cbe57907ed8bbc2bdf0b0a7e0ab52f7d806e5149f98c73`, `src/render/print/plans.ts` `6b28b46f70ad8ca9f365d348b5dcae91de97002b116a2359513369db57fffc1b`, `src/render/print/rules.ts` `35494c1cb8ade3d1ef3acf5558aef1d210c8a45220aaf3ad0c92e94e3ef107f5`, `src/render/print/status.ts` `9bbc2feac3f7eb4afee45e3d54b083dd10e0259dc4003fb5cb1a8303b652198b`, `src/render/print/strip.ts` `9a21ba1e0555844b517f7189e2bcc946074b85afa031a35fbc7e4bbbf50cc454`, `src/render/print/title.ts` `020b96df1f42d1869ec8c05c508bc5b1368499b371f7d53158cc6d6017451b26`, `src/render/print/tree.ts` `deca3cd7dde0819ee7ba10a1f282e25eec8fa116a3531da9bde95c80d36379d6`, `src/render/reader.ts` `99f47dcafe594dd6691617523019ffa64401013d9b08579c14423297d539ac35`, `src/render/render.ts` `2e7faf421e389a90a57147032e24735ca85332b5f837816e67fb7a5c94c5bf4f`.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P7a | a waiting item whole, not clipped | the item clipped to the screen's 92 | `src/render/print/strip.ts` | red: 2 failed \| 56 passed (58). the pinned output plan: render(…, { print: true, reader: { rules: true } }) is conformance/print/plan.html; se |
| P7b | a waiting item is no link | the item's text in an `a` | `src/render/print/strip.ts` | red: 3 failed \| 55 passed (58). the pinned output plan: render(…, { print: true, reader: { rules: true } }) is conformance/print/plan.html; th |
| P7c | no owner bracket or colon printed | the step's brackets and colon kept | `src/render/print/plans.ts` | red: 2 failed \| 56 passed (58). the pinned output plan: render(…, { print: true, reader: { rules: true } }) is conformance/print/plan.html; se |
| P7d | no hidden attribute written | `hidden` added to the attributes the writer keeps | `src/render/print/tree.ts` | red: 2 failed \| 12 passed (14). the attributes and the elements writes no attribute but class, id, data-line, open, colspan, rowspan, align, a |
| P7e | every rule of print.css scoped | the separator rule unscoped | `assets/print.css` | red: 2 failed \| 12 passed (14). assets/print.css scopes every rule under .docreader-print (P7e), and has no at-rule that could escape the scop |
| P7f | rules printed only with reader.rules | the rules switch removed | `src/render/print/rules.ts` | red: 1 failed \| 119 passed (120). the block groups rules: paragraphs with heads and pills, and the index in the facts panel; off with rules off  |
| P7g | each count with its word | the strip's counts without their words | `src/render/print/strip.ts` | red: 5 failed \| 115 passed (120). print mode agrees with the screen print fixture plan: the same; print mode agrees with the screen print fixtur |
| P7h | vocabulary.json equals the output | a class dropped from the file | `conformance/print/vocabulary.json` | red: 2 failed \| 12 passed (14). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7i | the plan fact's gate holds in print as on the screen (departure ccrc D-8868) | print's gate dropped: planFactApplies(steps) true from one step | `src/render/print/strip.ts` | red: 2 failed \| 60 passed (62). print mode agrees with the screen corpus spec-template: the strip, marks, labels and numbers are the screen's; |
| P7j | a raw tag in the source stays text (B10) | the html's entities decoded before it is read as a tree | `src/render/print/tree.ts` | red: 4 failed \| 10 passed (14). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7k | text written escaped | a text child written as it is held | `src/render/print/tree.ts` | red: 5 failed \| 9 passed (14). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7l | print must be a boolean | the check removed | `src/render/render.ts` | red: 1 failed \| 57 passed (58). the options print must be a boolean |
| P7m | print's html bounded by maxHtmlBytes | the bound on the printed html removed | `src/render/render.ts` | red: 1 failed \| 57 passed (58). the pinned output is bounded like the html: a print that would pass maxHtmlBytes falls back, as render does |
| P7n | every details open | open not set | `src/render/print/index.ts` | red: 5 failed \| 67 passed (72). the attributes and the elements turns a table's text-align style into align, a checkbox into the text of its b |
| P7o | text-align becomes align | align not written | `src/render/print/index.ts` | red: 1 failed \| 13 passed (14). the attributes and the elements turns a table's text-align style into align, a checkbox into the text of its b |
| P7p | the section number's full stop not printed | the separator kept | `src/render/print/boxes.ts` | red: 6 failed \| 114 passed (120). the pinned output plan: render(…, { print: true, reader: { rules: true } }) is conformance/print/plan.html; th |
| P7q | the strip goes after the byline | the strip first in the root | `src/render/print/strip.ts` | red: 4 failed \| 116 passed (120). the pinned output plan: render(…, { print: true, reader: { rules: true } }) is conformance/print/plan.html; th |
| P7r | the strip only for a document or a rules document | every document eligible | `src/render/print/strip.ts` | red: 1 failed \| 61 passed (62). print mode agrees with the screen corpus doc-shapes/byline-status: the strip, marks, labels and numbers are th |
| P7s | pill-wrap | the punctuation not joined to the pill | `src/render/print/status.ts` | red: 5 failed \| 115 passed (120). print mode agrees with the screen print fixture plan: the same; print mode agrees with the screen print fixtur |
| P7t | group rows are not counted as decisions | a group row counted | `src/render/print/strip.ts` | red: 3 failed \| 117 passed (120). print mode agrees with the screen print fixture plan: the same; the pinned output plan: render(…, { print: tru |
| P7u | the joins between rule IDs not printed | the joins kept | `src/render/print/rules.ts` | red: 2 failed \| 56 passed (58). the pinned output rules: render(…, { print: true, reader: { rules: true } }) is conformance/print/rules.html;  |
| P7v | the dash and what follows not printed | the hidden run kept | `src/render/print/rules.ts` | red: 2 failed \| 56 passed (58). the pinned output rules: render(…, { print: true, reader: { rules: true } }) is conformance/print/rules.html;  |
| P7w | only the first Waiting box is the strip's | every Waiting box adds its items | `src/render/print/boxes.ts` | red: 1 failed \| 61 passed (62). print mode agrees with the screen print fixture boxes: the same |
| P7x | the reader's own is named yours | the yours class dropped | `src/render/print/plans.ts` | red: 4 failed \| 116 passed (120). print mode agrees with the screen print fixture plan: the same; the pinned output plan: render(…, { print: tru |
| P7y | the reading time from 3 minutes | threshold 0 | `src/render/print/title.ts` | red: 20 failed \| 100 passed (120). print mode agrees with the screen corpus headings: the strip, marks, labels and numbers are the screen's; prin |
| P7z | a fact over 70 characters is wide | threshold 7 | `src/render/print/title.ts` | red: 5 failed \| 57 passed (62). print mode agrees with the screen corpus doc-shapes/byline-status: the strip, marks, labels and numbers are th |
| P7aa | the document's kind from the front matter in the eyebrow | no front-matter kind | `src/render/print/title.ts` | red: 5 failed \| 115 passed (120). print mode agrees with the screen corpus spec-template: the strip, marks, labels and numbers are the screen's; |
| P7ab | reader.plan is checked | the group unchecked | `src/render/reader.ts` | red: 2 failed \| 56 passed (58). the options reader plan not an object: render takes it exactly when the reader's features.vocabulary does; the |
| P7ac | reader.status is checked | the group unchecked | `src/render/reader.ts` | red: 3 failed \| 55 passed (58). the options reader status not an object: render takes it exactly when the reader's features.vocabulary does; t |
| P7ad | reader.attention is checked | the group unchecked | `src/render/reader.ts` | red: 1 failed \| 57 passed (58). the options reader attention unknown key: render takes it exactly when the reader's features.vocabulary does |
| P7ae | reader.ids and ruleIds grammars are checked | the grammar unchecked | `src/render/reader.ts` | red: 3 failed \| 55 passed (58). the options reader ids true: render takes it exactly when the reader's features.vocabulary does; the options r |
| P7af | reader.ruleIds grammar is checked | the grammar unchecked | `src/render/reader.ts` | red: 2 failed \| 56 passed (58). the options reader ruleIds not an object: render takes it exactly when the reader's features.vocabulary does;  |
| P7ag | reader.rules is a boolean | the check removed | `src/render/reader.ts` | red: 1 failed \| 57 passed (58). the options reader.rules is a boolean (print's own flag), and a value of another type is a TypeError |
| P7ah | an unknown reader key is refused | the check removed | `src/render/reader.ts` | red: 6 failed \| 140 passed (146). the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 t |
| P7ai | a reader getter is refused | the check removed | `src/render/reader.ts` | red: 2 failed \| 144 passed (146). the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 t |
| P7aj | a word is 1 to 64 code units with no outer white space | the word check removed | `src/render/reader.ts` | red: 6 failed \| 140 passed (146). the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 t |
| P7ak | a repeated word is dropped, as the reader drops it | duplicates kept | `src/render/reader.ts` | red: 1 failed \| 57 passed (58). the patterns are the reader's own set 1: every pattern print mode reads has the reader's source and flags |
| P7al | at most 200 words in a list | cap 2000 | `src/render/reader.ts` | red: 2 failed \| 144 passed (146). the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 t |

```json
[
  {
    "id": "P7a",
    "guard": "a waiting item whole, not clipped",
    "edit": "the item clipped to the screen's 92",
    "file": "src/render/print/strip.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 56,
    "total": 58,
    "red": [
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "section 6 fixture: a plan of three tasks, the reader as an owner, a Waiting box and a decisions table the long item is whole (past WAIT_CLIP, 92) and no waiting item is a link (P7a, P7b)"
    ]
  },
  {
    "id": "P7b",
    "guard": "a waiting item is no link",
    "edit": "the item's text in an `a`",
    "file": "src/render/print/strip.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 55,
    "total": 58,
    "red": [
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "the pinned output boxes: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/boxes.html",
      "section 6 fixture: a plan of three tasks, the reader as an owner, a Waiting box and a decisions table the long item is whole (past WAIT_CLIP, 92) and no waiting item is a link (P7a, P7b)"
    ]
  },
  {
    "id": "P7c",
    "guard": "no owner bracket or colon printed",
    "edit": "the step's brackets and colon kept",
    "file": "src/render/print/plans.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 56,
    "total": 58,
    "red": [
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "section 6 fixture: a plan of three tasks, the reader as an owner, a Waiting box and a decisions table prints no bracket or colon of a step's owner (P7c)"
    ]
  },
  {
    "id": "P7d",
    "guard": "no hidden attribute written",
    "edit": "`hidden` added to the attributes the writer keeps",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 12,
    "total": 14,
    "red": [
      "the attributes and the elements writes no attribute but class, id, data-line, open, colspan, rowspan, align, alt, title and href, over the corpus",
      "the attributes and the elements writes no hidden attribute even from a node that has one (P7d), and no event handler or style"
    ]
  },
  {
    "id": "P7e",
    "guard": "every rule of print.css scoped",
    "edit": "the separator rule unscoped",
    "file": "assets/print.css",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 12,
    "total": 14,
    "red": [
      "assets/print.css scopes every rule under .docreader-print (P7e), and has no at-rule that could escape the scope",
      "assets/print.css prints the separators in the muted text colour, never an edge colour"
    ]
  },
  {
    "id": "P7f",
    "guard": "rules printed only with reader.rules",
    "edit": "the rules switch removed",
    "file": "src/render/print/rules.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 119,
    "total": 120,
    "red": [
      "the block groups rules: paragraphs with heads and pills, and the index in the facts panel; off with rules off (P7f)"
    ]
  },
  {
    "id": "P7g",
    "guard": "each count with its word",
    "edit": "the strip's counts without their words",
    "file": "src/render/print/strip.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 115,
    "total": 120,
    "red": [
      "print mode agrees with the screen print fixture plan: the same",
      "print mode agrees with the screen print fixture status: the same",
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html"
    ]
  },
  {
    "id": "P7h",
    "guard": "vocabulary.json equals the output",
    "edit": "a class dropped from the file",
    "file": "conformance/print/vocabulary.json",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 12,
    "total": 14,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "conformance/print/vocabulary.json is sorted, without repeats, and names the print root and each class of the strip and the plan marks"
    ]
  },
  {
    "id": "P7i",
    "guard": "the plan fact's gate holds in print as on the screen (departure ccrc D-8868)",
    "edit": "print's gate dropped: planFactApplies(steps) true from one step",
    "file": "src/render/print/strip.ts",
    "tests": "test/print-agreement.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 60,
    "total": 62,
    "red": [
      "print mode agrees with the screen corpus spec-template: the strip, marks, labels and numbers are the screen's",
      "print mode agrees with the screen the plan fact has the screen's gate: none at 19 steps on either side, both at 20 (ccrc D-8868)"
    ]
  },
  {
    "id": "P7j",
    "guard": "a raw tag in the source stays text (B10)",
    "edit": "the html's entities decoded before it is read as a tree",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 10,
    "total": 14,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "a raw tag in the source never becomes an element of print's tree (B10) stays text: the tree holds no script, style, img or forged strip or pill from the source, and the tag is escaped in the html",
      "a raw tag in the source never becomes an element of print's tree (B10) a forged rs-wait or review-strip is text, so the only strip is the one print mode builds"
    ]
  },
  {
    "id": "P7k",
    "guard": "text written escaped",
    "edit": "a text child written as it is held",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 9,
    "total": 14,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "the attributes and the elements writes no attribute but class, id, data-line, open, colspan, rowspan, align, alt, title and href, over the corpus",
      "a raw tag in the source never becomes an element of print's tree (B10) stays text: the tree holds no script, style, img or forged strip or pill from the source, and the tag is escaped in the html"
    ]
  },
  {
    "id": "P7l",
    "guard": "print must be a boolean",
    "edit": "the check removed",
    "file": "src/render/render.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 57,
    "total": 58,
    "red": [
      "the options print must be a boolean"
    ]
  },
  {
    "id": "P7m",
    "guard": "print's html bounded by maxHtmlBytes",
    "edit": "the bound on the printed html removed",
    "file": "src/render/render.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 57,
    "total": 58,
    "red": [
      "the pinned output is bounded like the html: a print that would pass maxHtmlBytes falls back, as render does"
    ]
  },
  {
    "id": "P7n",
    "guard": "every details open",
    "edit": "open not set",
    "file": "src/render/print/index.ts",
    "tests": "test/render-print.test.ts test/print-surface.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 67,
    "total": 72,
    "red": [
      "the attributes and the elements turns a table's text-align style into align, a checkbox into the text of its box, and opens every details",
      "the pinned output title: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/title.html",
      "the pinned output rules: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/rules.html"
    ]
  },
  {
    "id": "P7o",
    "guard": "text-align becomes align",
    "edit": "align not written",
    "file": "src/render/print/index.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 13,
    "total": 14,
    "red": [
      "the attributes and the elements turns a table's text-align style into align, a checkbox into the text of its box, and opens every details"
    ]
  },
  {
    "id": "P7p",
    "guard": "the section number's full stop not printed",
    "edit": "the separator kept",
    "file": "src/render/print/boxes.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 6,
    "passed": 114,
    "total": 120,
    "red": [
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "the pinned output title: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/title.html",
      "the pinned output boxes: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/boxes.html"
    ]
  },
  {
    "id": "P7q",
    "guard": "the strip goes after the byline",
    "edit": "the strip first in the root",
    "file": "src/render/print/strip.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 116,
    "total": 120,
    "red": [
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "the pinned output boxes: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/boxes.html",
      "the pinned output status: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/status.html"
    ]
  },
  {
    "id": "P7r",
    "guard": "the strip only for a document or a rules document",
    "edit": "every document eligible",
    "file": "src/render/print/strip.ts",
    "tests": "test/print-agreement.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "print mode agrees with the screen corpus doc-shapes/byline-status: the strip, marks, labels and numbers are the screen's"
    ]
  },
  {
    "id": "P7s",
    "guard": "pill-wrap",
    "edit": "the punctuation not joined to the pill",
    "file": "src/render/print/status.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 115,
    "total": 120,
    "red": [
      "print mode agrees with the screen print fixture plan: the same",
      "print mode agrees with the screen print fixture status: the same",
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html"
    ]
  },
  {
    "id": "P7t",
    "guard": "group rows are not counted as decisions",
    "edit": "a group row counted",
    "file": "src/render/print/strip.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 117,
    "total": 120,
    "red": [
      "print mode agrees with the screen print fixture plan: the same",
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "section 6 fixture: a plan of three tasks, the reader as an owner, a Waiting box and a decisions table the decisions counts are span.cnt, each its number and its word, most first (P7g)"
    ]
  },
  {
    "id": "P7u",
    "guard": "the joins between rule IDs not printed",
    "edit": "the joins kept",
    "file": "src/render/print/rules.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 56,
    "total": 58,
    "red": [
      "the pinned output rules: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/rules.html",
      "the block groups rules: paragraphs with heads and pills, and the index in the facts panel; off with rules off (P7f)"
    ]
  },
  {
    "id": "P7v",
    "guard": "the dash and what follows not printed",
    "edit": "the hidden run kept",
    "file": "src/render/print/rules.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 56,
    "total": 58,
    "red": [
      "the pinned output rules: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/rules.html",
      "the block groups rules: paragraphs with heads and pills, and the index in the facts panel; off with rules off (P7f)"
    ]
  },
  {
    "id": "P7w",
    "guard": "only the first Waiting box is the strip's",
    "edit": "every Waiting box adds its items",
    "file": "src/render/print/boxes.ts",
    "tests": "test/print-agreement.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "print mode agrees with the screen print fixture boxes: the same"
    ]
  },
  {
    "id": "P7x",
    "guard": "the reader's own is named yours",
    "edit": "the yours class dropped",
    "file": "src/render/print/plans.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 116,
    "total": 120,
    "red": [
      "print mode agrees with the screen print fixture plan: the same",
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html",
      "section 6 fixture: a plan of three tasks, the reader as an owner, a Waiting box and a decisions table each task heading has span.task-id with its step count and owner as span.tmeta"
    ]
  },
  {
    "id": "P7y",
    "guard": "the reading time from 3 minutes",
    "edit": "threshold 0",
    "file": "src/render/print/title.ts",
    "tests": "test/print-agreement.test.ts test/render-print.test.ts",
    "rc": 1,
    "failed": 20,
    "passed": 100,
    "total": 120,
    "red": [
      "print mode agrees with the screen corpus headings: the strip, marks, labels and numbers are the screen's",
      "print mode agrees with the screen corpus heading-unicode-case: the strip, marks, labels and numbers are the screen's",
      "print mode agrees with the screen corpus alerts: the strip, marks, labels and numbers are the screen's"
    ]
  },
  {
    "id": "P7z",
    "guard": "a fact over 70 characters is wide",
    "edit": "threshold 7",
    "file": "src/render/print/title.ts",
    "tests": "test/print-agreement.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 57,
    "total": 62,
    "red": [
      "print mode agrees with the screen corpus doc-shapes/byline-status: the strip, marks, labels and numbers are the screen's",
      "print mode agrees with the screen corpus spec-template: the strip, marks, labels and numbers are the screen's",
      "print mode agrees with the screen print fixture plan: the same"
    ]
  },
  {
    "id": "P7aa",
    "guard": "the document's kind from the front matter in the eyebrow",
    "edit": "no front-matter kind",
    "file": "src/render/print/title.ts",
    "tests": "test/render-print.test.ts test/print-agreement.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 115,
    "total": 120,
    "red": [
      "print mode agrees with the screen corpus spec-template: the strip, marks, labels and numbers are the screen's",
      "print mode agrees with the screen print fixture title: the same",
      "print mode agrees with the screen the fixtures exercise what they claim (not agreement of two empties)"
    ]
  },
  {
    "id": "P7ab",
    "guard": "reader.plan is checked",
    "edit": "the group unchecked",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 56,
    "total": 58,
    "red": [
      "the options reader plan not an object: render takes it exactly when the reader's features.vocabulary does",
      "the options reader plan bad word: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7ac",
    "guard": "reader.status is checked",
    "edit": "the group unchecked",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 55,
    "total": 58,
    "red": [
      "the options reader status not an object: render takes it exactly when the reader's features.vocabulary does",
      "the options reader status unknown role: render takes it exactly when the reader's features.vocabulary does",
      "the options reader status list bad: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7ad",
    "guard": "reader.attention is checked",
    "edit": "the group unchecked",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 57,
    "total": 58,
    "red": [
      "the options reader attention unknown key: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7ae",
    "guard": "reader.ids and ruleIds grammars are checked",
    "edit": "the grammar unchecked",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 55,
    "total": 58,
    "red": [
      "the options reader ids true: render takes it exactly when the reader's features.vocabulary does",
      "the options reader ids prefixes bad: render takes it exactly when the reader's features.vocabulary does",
      "the options reader ids unknown key: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7af",
    "guard": "reader.ruleIds grammar is checked",
    "edit": "the grammar unchecked",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 56,
    "total": 58,
    "red": [
      "the options reader ruleIds not an object: render takes it exactly when the reader's features.vocabulary does",
      "the options reader ruleIds unknown key: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7ag",
    "guard": "reader.rules is a boolean",
    "edit": "the check removed",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 57,
    "total": 58,
    "red": [
      "the options reader.rules is a boolean (print's own flag), and a value of another type is a TypeError"
    ]
  },
  {
    "id": "P7ah",
    "guard": "an unknown reader key is refused",
    "edit": "the check removed",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts test/render-items.test.ts",
    "rc": 1,
    "failed": 6,
    "passed": 140,
    "total": 146,
    "red": [
      "the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units",
      "the options reader status unknown role: render takes it exactly when the reader's features.vocabulary does",
      "the options reader attention unknown key: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7ai",
    "guard": "a reader getter is refused",
    "edit": "the check removed",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts test/render-items.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 144,
    "total": 146,
    "red": [
      "the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units",
      "the options reader a getter: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7aj",
    "guard": "a word is 1 to 64 code units with no outer white space",
    "edit": "the word check removed",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts test/render-items.test.ts",
    "rc": 1,
    "failed": 6,
    "passed": 140,
    "total": 146,
    "red": [
      "the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units",
      "the options reader a word over 64: render takes it exactly when the reader's features.vocabulary does",
      "the options reader an empty word: render takes it exactly when the reader's features.vocabulary does"
    ]
  },
  {
    "id": "P7ak",
    "guard": "a repeated word is dropped, as the reader drops it",
    "edit": "duplicates kept",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 57,
    "total": 58,
    "red": [
      "the patterns are the reader's own set 1: every pattern print mode reads has the reader's source and flags"
    ]
  },
  {
    "id": "P7al",
    "guard": "at most 200 words in a list",
    "edit": "cap 2000",
    "file": "src/render/reader.ts",
    "tests": "test/render-print.test.ts test/render-items.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 144,
    "total": 146,
    "red": [
      "the reader option is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units",
      "the options reader 201 words: render takes it exactly when the reader's features.vocabulary does"
    ]
  }
]
```

## Review round 1 (docserver parity T7)

Measured the same way, in place, at the state of the round-1 commit (the files of rows P7a to P7al were edited in this round only where the rows below say; their sha256 above are of the first commit). Rows P7am to P7aw are this round's. The sha256 of each file as restored: `conformance/print/vocabulary.json` `e41c3fc8166003b0f7f24538b7972a24db5a01d11e57c7fa4781ee1f17a45297`, `package.json` `0c0f4e8a777d6a95756393cd8f28e70415d6b2e7d1674f27b652c8a0dc3ec92e`, `src/render/print/index.ts` `80523df599d7842815cbe57907ed8bbc2bdf0b0a7e0ab52f7d806e5149f98c73`, `src/render/print/tree.ts` `04265aafe2be61f64b9d77f5374fed2b8df39331ae3831d864e4b98de7e70493`, `test/pack.test.ts` `e1bf60b9a1d68388d0d308d44b9b72c8a624286b4c049b9b6d8e74f2dd3ffc43`.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P7am | print is linear in the block count (sibling walks keep their position) | the position hint ignored, so each walk step scans from the start | `src/render/print/tree.ts` | red: 1 failed \| 17 passed (18). the cost of print mode is linear in the document looks at no sibling position past a node's own but a few: a w |
| P7an | vocabulary.json holds every alert kind | gh-caution dropped from the file | `conformance/print/vocabulary.json` | red: 2 failed \| 16 passed (18). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7ao | only two open class families | a third family declared | `conformance/print/vocabulary.json` | red: 1 failed \| 17 passed (18). conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed cla |
| P7ap | src on an img only | src kept on every element | `src/render/print/tree.ts` | red: 1 failed \| 79 passed (80). the attributes and the elements keeps src on an img only, and on no other element (P7ap) |
| P7aq | an img keeps its src | src not kept | `src/render/print/tree.ts` | red: 4 failed \| 76 passed (80). the attributes and the elements writes no attribute but class, id, data-line, open, colspan, rowspan, align, a |
| P7ar | a task's checkbox prints as span.task-check | the box's text not written | `src/render/print/index.ts` | red: 5 failed \| 75 passed (80). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7as | the open families are declared | language- dropped from the families | `conformance/print/vocabulary.json` | red: 2 failed \| 16 passed (18). conformance/print/vocabulary.json is complete for what the consumer derives from it: every alert kind, every h |
| P7at | highlight.js's sub-scope classes are listed | function_ dropped from the file | `conformance/print/vocabulary.json` | red: 3 failed \| 15 passed (18). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7au | the package ships conformance/print | conformance/print left out of `files` | `package.json` | red: 1 failed \| 14 passed (15). npm pack holds the six entries with their types, the corpus files, the licence, the readme, the assets and the |
| P7av | pack allows assets/print.css and no unnamed file | the print.css pattern removed from ALLOWED | `test/pack.test.ts` | red: 1 failed \| 14 passed (15). npm pack holds nothing else: no references, scripts, sources, tests, CI files or working papers |
| P7aw | dist/render/print is shipped and allowed | the dist/render/print pattern removed from ALLOWED | `test/pack.test.ts` | red: 1 failed \| 14 passed (15). npm pack holds nothing else: no references, scripts, sources, tests, CI files or working papers |

```json
[
  {
    "id": "P7am",
    "guard": "print is linear in the block count (sibling walks keep their position)",
    "edit": "the position hint ignored, so each walk step scans from the start",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 17,
    "total": 18,
    "red": [
      "the cost of print mode is linear in the document looks at no sibling position past a node's own but a few: a walk over N blocks costs O(N), not O(N squared) (P7am)"
    ]
  },
  {
    "id": "P7an",
    "guard": "vocabulary.json holds every alert kind",
    "edit": "gh-caution dropped from the file",
    "file": "conformance/print/vocabulary.json",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 16,
    "total": 18,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "conformance/print/vocabulary.json is complete for what the consumer derives from it: every alert kind, every heading level, and every class print emits is listed or in a family (P7an)"
    ]
  },
  {
    "id": "P7ao",
    "guard": "only two open class families",
    "edit": "a third family declared",
    "file": "conformance/print/vocabulary.json",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 17,
    "total": 18,
    "red": [
      "conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed class is in one, and no other family is declared (P7ao)"
    ]
  },
  {
    "id": "P7ap",
    "guard": "src on an img only",
    "edit": "src kept on every element",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts test/render-print.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 79,
    "total": 80,
    "red": [
      "the attributes and the elements keeps src on an img only, and on no other element (P7ap)"
    ]
  },
  {
    "id": "P7aq",
    "guard": "an img keeps its src",
    "edit": "src not kept",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts test/render-print.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 76,
    "total": 80,
    "red": [
      "the attributes and the elements writes no attribute but class, id, data-line, open, colspan, rowspan, align, alt, title and href, and an img's src, over the corpus",
      "the attributes and the elements keeps src on an img only, and on no other element (P7ap)",
      "the pinned output boxes: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/boxes.html"
    ]
  },
  {
    "id": "P7ar",
    "guard": "a task's checkbox prints as span.task-check",
    "edit": "the box's text not written",
    "file": "src/render/print/index.ts",
    "tests": "test/print-surface.test.ts test/render-print.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 75,
    "total": 80,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "the attributes and the elements turns a table's text-align style into align, a checkbox into the text of its box, and opens every details",
      "the pinned output plan: render(\u2026, { print: true, reader: { rules: true } }) is conformance/print/plan.html"
    ]
  },
  {
    "id": "P7as",
    "guard": "the open families are declared",
    "edit": "language- dropped from the families",
    "file": "conformance/print/vocabulary.json",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 16,
    "total": 18,
    "red": [
      "conformance/print/vocabulary.json is complete for what the consumer derives from it: every alert kind, every heading level, and every class print emits is listed or in a family (P7an)",
      "conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed class is in one, and no other family is declared (P7ao)"
    ]
  },
  {
    "id": "P7at",
    "guard": "highlight.js's sub-scope classes are listed",
    "edit": "function_ dropped from the file",
    "file": "conformance/print/vocabulary.json",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 15,
    "total": 18,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "conformance/print/vocabulary.json is complete for what the consumer derives from it: every alert kind, every heading level, and every class print emits is listed or in a family (P7an)",
      "conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed class is in one, and no other family is declared (P7ao)"
    ]
  },
  {
    "id": "P7au",
    "guard": "the package ships conformance/print",
    "edit": "conformance/print left out of `files`",
    "file": "package.json",
    "tests": "test/pack.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 14,
    "total": 15,
    "red": [
      "npm pack holds the six entries with their types, the corpus files, the licence, the readme, the assets and their notices"
    ]
  },
  {
    "id": "P7av",
    "guard": "pack allows assets/print.css and no unnamed file",
    "edit": "the print.css pattern removed from ALLOWED",
    "file": "test/pack.test.ts",
    "tests": "test/pack.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 14,
    "total": 15,
    "red": [
      "npm pack holds nothing else: no references, scripts, sources, tests, CI files or working papers"
    ]
  },
  {
    "id": "P7aw",
    "guard": "dist/render/print is shipped and allowed",
    "edit": "the dist/render/print pattern removed from ALLOWED",
    "file": "test/pack.test.ts",
    "tests": "test/pack.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 14,
    "total": 15,
    "red": [
      "npm pack holds nothing else: no references, scripts, sources, tests, CI files or working papers"
    ]
  }
]
```

## Review round 2 (docserver parity T7)

The probe counter is removed from `src/render/print/tree.ts`; the quadratic guard now spies on `Array.prototype.indexOf`, `lastIndexOf` and `findIndex` and holds print's added long-array searches under 50, with a time case (20 000 blocks print within 10 times the plain render's time plus 1.5 s). Row P7am of round 1 (the hint ignored, judged by the removed counter) is replaced: its edit is now P7bb, red through the time case, and P7am2 (nextEl through `indexOf`) and P7ax (idx through `indexOf`) are red through the spy. Measured the same way, in place. The sha256 of each file as restored: `src/render/print/tree.ts` `e36d64aca536f85cea2082789846ae3517df6816cfc3e0901dbb3f9cdc93f33e`, `test/print-vocabulary.ts` `17804aaafd497441094fce40ee26bd0df497434bc8a40b71d4a95eebcca9f216`.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P7am2 | print searches no long array for a node's position (the spy on indexOf, lastIndexOf and findIndex) | nextEl finds its node with p.kids.indexOf again | `src/render/print/tree.ts` | red: 1 failed \| 19 passed (20). the cost of print mode is linear in the document searches no long array for a node's position: print adds few  |
| P7ax | print searches no long array for a node's position | idx answers through indexOf | `src/render/print/tree.ts` | red: 1 failed \| 19 passed (20). the cost of print mode is linear in the document searches no long array for a node's position: print adds few  |
| P7bb | print's time is in proportion to the document | the position hint ignored (each walk step scans from the start, with no indexOf) | `src/render/print/tree.ts` | red: 3 failed \| 2 passed (20). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7ay | a numbered capture names a scope (inherited__ is listed) | the scope key's regex without digits | `test/print-vocabulary.ts` | red: 1 failed \| 19 passed (20). conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed cla |
| P7az | a label is never a class (def_ is not listed) | the label exclusion removed | `test/print-vocabulary.ts` | red: 2 failed \| 18 passed (20). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7bc | the registered languages are read from highlight.ts | only the first five languages read | `test/print-vocabulary.ts` | red: 1 failed \| 0 passed (20). conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtu |
| P7ba | wrap takes adjacent siblings of one parent | the adjacency check removed | `src/render/print/tree.ts` | red: 1 failed \| 19 passed (20). wrap takes adjacent siblings of one parent, in order, and throws on anything else (P7ba) |

```json
[
  {
    "id": "P7am2",
    "guard": "print searches no long array for a node's position (the spy on indexOf, lastIndexOf and findIndex)",
    "edit": "nextEl finds its node with p.kids.indexOf again",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 19,
    "total": 20,
    "red": [
      "the cost of print mode is linear in the document searches no long array for a node's position: print adds few such searches to a render, however many blocks (P7am, P7ax)"
    ]
  },
  {
    "id": "P7ax",
    "guard": "print searches no long array for a node's position",
    "edit": "idx answers through indexOf",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 19,
    "total": 20,
    "red": [
      "the cost of print mode is linear in the document searches no long array for a node's position: print adds few such searches to a render, however many blocks (P7am, P7ax)"
    ]
  },
  {
    "id": "P7bb",
    "guard": "print's time is in proportion to the document",
    "edit": "the position hint ignored (each walk step scans from the start, with no indexOf)",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 2,
    "total": 20,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "conformance/print/vocabulary.json is complete for what the consumer derives from it: every alert kind, every heading level, and every class print emits is listed or in a family (P7an)",
      "the attributes and the elements writes no attribute but class, id, data-line, open, colspan, rowspan, align, alt, title and href, and an img's src, over the corpus"
    ]
  },
  {
    "id": "P7ay",
    "guard": "a numbered capture names a scope (inherited__ is listed)",
    "edit": "the scope key's regex without digits",
    "file": "test/print-vocabulary.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 19,
    "total": 20,
    "red": [
      "conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed class is in one, and no other family is declared (P7ao)"
    ]
  },
  {
    "id": "P7az",
    "guard": "a label is never a class (def_ is not listed)",
    "edit": "the label exclusion removed",
    "file": "test/print-vocabulary.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 18,
    "total": 20,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)",
      "conformance/print/vocabulary.json declares two open families, hljs- and language-, and no other: no listed class is in one, and no other family is declared (P7ao)"
    ]
  },
  {
    "id": "P7bc",
    "guard": "the registered languages are read from highlight.ts",
    "edit": "only the first five languages read",
    "file": "test/print-vocabulary.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 0,
    "total": 20,
    "red": [
      "conformance/print/vocabulary.json lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)"
    ]
  },
  {
    "id": "P7ba",
    "guard": "wrap takes adjacent siblings of one parent",
    "edit": "the adjacency check removed",
    "file": "src/render/print/tree.ts",
    "tests": "test/print-surface.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 19,
    "total": 20,
    "red": [
      "wrap takes adjacent siblings of one parent, in order, and throws on anything else (P7ba)"
    ]
  }
]
```
