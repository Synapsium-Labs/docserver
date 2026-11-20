# Task 5 mutation rows (the reader applies a verdict: hosted state, Aa, faces, the html mark)

Each row mutated the named source file in place (original bytes saved, sha256 checked equal after each restore), one at a time, and ran `test/enhance-appearance.test.ts` (jsdom; the browser file `test/browser/frame-appearance.test.ts` is not needed to red any row).

| Row | Guard | File | Edit | Tests run | Result |
|---|---|---|---|---|---|
| A5a | stored theme ignored while hosted | `src/enhance/state.ts` | stored theme honoured while hosted (the verdict mode no longer overrides it at startup) | `test/enhance-appearance.test.ts` | red (6 failed, 56 passed of 62) |
| A5b | prefs write omits theme while hosted | `src/enhance/state.ts` | prefs write keeps theme (the whole change, stored theme included, is written) | `test/enhance-appearance.test.ts` | red (2 failed, 60 passed of 62) |
| A5c | no theme row while hosted | `src/enhance/settings.ts` | theme row kept while hosted (never skipped, never removed) | `test/enhance-appearance.test.ts` | red (2 failed, 60 passed of 62) |
| A5d | the label is text content only | `src/enhance/settings.ts` | label as markup (innerHTML, an element-creating path) | `test/enhance-appearance.test.ts` | red (1 failed, 61 passed of 62) |
| A5e | a verdict with no colour group removes the colours | `src/enhance/state.ts` | no-colour op keeps the colours | `test/enhance-appearance.test.ts` | red (1 failed, 61 passed of 62) |
| A5f | the html mark is cleared with the colours | `src/frame-runtime/enhance-entry.ts` | html mark not cleared | `test/enhance-appearance.test.ts` | red (2 failed, 60 passed of 62) |
| A5g | a bad face never throws and never stops the other role | `src/frame-runtime/host-fonts.ts` | a bad face throws (both catch blocks rethrow) | `test/enhance-appearance.test.ts` | red (5 failed, 57 passed of 62) |
| A5h | the seed is applied in the first synchronous run | `src/enhance/lifecycle.ts` | appearance applied after the first yield (a microtask later) | `test/enhance-appearance.test.ts` | red (1 failed, 61 passed of 62) |
| A5i | a queued appearance is applied at startup | `src/enhance/lifecycle.ts` | the queued appearance is dropped | `test/enhance-appearance.test.ts` | red (2 failed, 71 passed of 73) |
| A5j | a variable face gets the weight range | `src/frame-runtime/host-fonts.ts` | always the static weight (no range for a variable face) | `test/enhance-appearance.test.ts` | red (3 failed, 70 passed of 73) |
| A5k | the queued appearance is applied before the queued prefs | `src/enhance/lifecycle.ts` | queued prefs applied before the queued appearance (the old order) | `test/enhance-appearance.test.ts` | red (1 failed, 72 passed of 73) |
| A5l | only the properties the last verdict wrote are removed | `src/enhance/state.ts` | every slot property is removed or written, as before (a host token on the root is lost) | `test/enhance-appearance.test.ts` | red (1 failed, 72 passed of 73) |
| A5m | the html mark follows the reader | `src/frame-runtime/enhance-entry.ts` | the mark is set before the reader takes the value | `test/enhance-appearance.test.ts` | red (1 failed, 72 passed of 73) |
| A5n | destroy clears the html mark | `src/frame-runtime/enhance-entry.ts` | destroy leaves the mark and the tooltip properties | `test/enhance-appearance.test.ts` | red (1 failed, 72 passed of 73) |

Rows A5i to A5n were added in the fix round (test file at 73 rows): A5i queued appearance dropped, A5j variable faces get the static weight, A5k queued prefs applied before the queued appearance, A5l every slot property removed (a host's own inline token lost), A5m html mark set before the reader takes the value, A5n destroy leaves the mark.

A5g rewrites both `catch` blocks of `loadHostFonts` to rethrow; the rows that red it are the atob-refused strings (the case the Task 3 review named), a bad face leaving the other role loading, and the never-throws row.


## Review 2906 F9

The pre-decode guard of `src/frame-runtime/host-fonts.ts` is now `Math.ceil(CAP / 3) * 4`, 174 764 characters, the contract's face cap in characters (the seed's `fontFaceMaxChars`; the test reads that constant and asserts the length). It was `CAP * 1.4` (183 500), which no test pinned: the one over-cap case, a face of 131 073 bytes, is 174 764 characters and is stopped by the post-decode byte check. No string just over the cap decodes to a face the byte check would pass, so the guard's effect is cost, and the test spies on `atob`. The rows were measured on the file in place (original bytes saved, sha256 `9d62ad47...a77ca` checked after each restore).

| Row | Guard | File | Edit | Tests run | Result |
|---|---|---|---|---|---|
| A5o | the pre-decode guard is the contract's face cap in characters | `src/frame-runtime/host-fonts.ts` | `text.length > CAP_CHARS` back to `text.length > CAP * 1.4` (183 500) | `test/enhance-appearance.test.ts` | red (1 failed, 75 passed of 76) |
| A5p | the guard's boundary is exact (a string at the cap reaches the decoder, one character more does not) | `src/frame-runtime/host-fonts.ts` | `text.length > CAP_CHARS` to `text.length >= CAP_CHARS` | `test/enhance-appearance.test.ts` | red (2 failed, 74 passed of 76) |
| A5q | a string over the cap is never decoded | `src/frame-runtime/host-fonts.ts` | the length test removed (`text.length > CAP_CHARS || ` dropped) | `test/enhance-appearance.test.ts` | red (1 failed, 75 passed of 76) |

```json
[
  {
    "row": "A5a",
    "guard": "stored theme ignored while hosted",
    "edit": "stored theme honoured while hosted (the verdict mode no longer overrides it at startup)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/state.ts",
    "summary": "6 failed | 56 passed (62)"
  },
  {
    "row": "A5b",
    "guard": "prefs write omits theme while hosted",
    "edit": "prefs write keeps theme (the whole change, stored theme included, is written)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/state.ts",
    "summary": "2 failed | 60 passed (62)"
  },
  {
    "row": "A5c",
    "guard": "no theme row while hosted",
    "edit": "theme row kept while hosted (never skipped, never removed)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/settings.ts",
    "summary": "2 failed | 60 passed (62)"
  },
  {
    "row": "A5d",
    "guard": "the label is text content only",
    "edit": "label as markup (innerHTML, an element-creating path)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/settings.ts",
    "summary": "1 failed | 61 passed (62)"
  },
  {
    "row": "A5e",
    "guard": "a verdict with no colour group removes the colours",
    "edit": "no-colour op keeps the colours",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/state.ts",
    "summary": "1 failed | 61 passed (62)"
  },
  {
    "row": "A5f",
    "guard": "the html mark is cleared with the colours",
    "edit": "html mark not cleared",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/enhance-entry.ts",
    "summary": "2 failed | 60 passed (62)"
  },
  {
    "row": "A5g",
    "guard": "a bad face never throws and never stops the other role",
    "edit": "a bad face throws (both catch blocks rethrow)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/host-fonts.ts",
    "summary": "5 failed | 57 passed (62)"
  },
  {
    "row": "A5h",
    "guard": "the seed is applied in the first synchronous run",
    "edit": "appearance applied after the first yield (a microtask later)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/lifecycle.ts",
    "summary": "1 failed | 61 passed (62)"
  },
  {
    "row": "A5i",
    "guard": "a queued appearance is applied at startup",
    "edit": "the queued appearance is dropped",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/lifecycle.ts",
    "summary": "2 failed | 71 passed (73)"
  },
  {
    "row": "A5j",
    "guard": "a variable face gets the weight range",
    "edit": "always the static weight (no range for a variable face)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/host-fonts.ts",
    "summary": "3 failed | 70 passed (73)"
  },
  {
    "row": "A5k",
    "guard": "the queued appearance is applied before the queued prefs",
    "edit": "queued prefs applied before the queued appearance (the old order)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/lifecycle.ts",
    "summary": "1 failed | 72 passed (73)"
  },
  {
    "row": "A5l",
    "guard": "only the properties the last verdict wrote are removed",
    "edit": "every slot property is removed or written, as before (a host token on the root is lost)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/enhance/state.ts",
    "summary": "1 failed | 72 passed (73)"
  },
  {
    "row": "A5m",
    "guard": "the html mark follows the reader",
    "edit": "the mark is set before the reader takes the value",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/enhance-entry.ts",
    "summary": "1 failed | 72 passed (73)"
  },
  {
    "row": "A5n",
    "guard": "destroy clears the html mark",
    "edit": "destroy leaves the mark and the tooltip properties",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/enhance-entry.ts",
    "summary": "1 failed | 72 passed (73)"
  },
  {
    "row": "A5o",
    "guard": "the pre-decode guard is the contract's face cap in characters",
    "edit": "text.length > CAP_CHARS back to text.length > CAP * 1.4 (183 500)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/host-fonts.ts",
    "summary": "1 failed, 75 passed of 76"
  },
  {
    "row": "A5p",
    "guard": "the guard's boundary is exact (a string at the cap reaches the decoder, one character more does not)",
    "edit": "text.length > CAP_CHARS to text.length >= CAP_CHARS",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/host-fonts.ts",
    "summary": "2 failed, 74 passed of 76"
  },
  {
    "row": "A5q",
    "guard": "a string over the cap is never decoded",
    "edit": "the length test removed (text.length > CAP_CHARS ||  dropped)",
    "tests": "test/enhance-appearance.test.ts",
    "result": "red",
    "file": "src/frame-runtime/host-fonts.ts",
    "summary": "1 failed, 75 passed of 76"
  }
]
```

## Review 2906 F10 and F11

The html mark moved behind the reader's journal (state.ts applyAppearance); the entry no longer touches `html`.

Departure from Task 5's file list, for the plan's "Departures and readings" (that file is edited by other fixes at the same time, so the bullet is kept here): **The `html` mark is the reader's, written through its journal (review 2906 F10 and F11).** Task 5's file list had `enhance-entry.ts` set the `html` element's `data-docreader-hosted` and the three tooltip properties before handing a value to the reader. They are written instead by `applyAppearance` on the root's own document element through `journal.setAttribute` and `journal.setStyle` (the three names join `STYLE_PROPS`), so a value the reader did not apply writes nothing and teardown puts the element back; the entry hands the reader's functions over as they are. The reader's walls allow that one reach (`documentElement`, once, in `state.ts`) and the frame runtime's walls refuse any `.style`. A reader enhancing a page in place now marks that page's `html` element too, as the frame's reader always did.

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| F10-journal | the tooltip properties on html are written through the journal | state.ts writes them with html.style.setProperty / removeProperty | test/enhance-walls.test.ts, test/enhance-appearance.test.ts | red: the `.style` wall (outside journal.ts), the named-site row, and the journaled-teardown and destroy rows (a host's own value not restored, the property left behind) |
| F10-attr | the html mark attribute is written through the journal | state.ts writes it with html.setAttribute / removeAttribute | test/enhance-appearance.test.ts | red: the journaled-teardown row (the host's own value is not put back) and the destroy row |
| F10-site | the reach to the document element is one named site, counted | ALLOWED_SITES state.ts documentElement 1 -> 2 | test/enhance-walls.test.ts | red: the exact-count row and the planted second reach |
| F10-props | the journal's closed list holds exactly the three tooltip names | `--dr-tip-edge` removed from STYLE_PROPS | test/enhance-appearance.test.ts, test/enhance-seams.test.ts | red: setStyle refuses the property, so every colour verdict throws (32 rows), and the list row |
| F10-root | a root that is the document element writes no mark of its own | `if (html === root) return;` removed | test/enhance-appearance.test.ts | red: the document-element-root row (a colourless verdict removes the root's own hosted attribute) |
| F10-frame-wall | the frame runtime writes no inline style | enhance-entry.ts wraps setEnhancementAppearance and writes document.documentElement.style.setProperty | test/frame-runtime-walls.test.ts | red: the sources row names `.style` (and the planted controls for enhance-entry.ts and adapters.ts, in each shape, are red by construction) |
| F11-entry | the entry marks nothing before or without the reader | enhance-entry.ts wraps setEnhancementAppearance and sets the html attribute before the call | test/enhance-appearance.test.ts | red: the unknown-root row and the hands-over-as-they-are row |
| F11-unknown | an op on a root the reader does not hold leaves html unmarked | lifecycle.ts setEnhancementAppearance sets the html attribute when findByRoot finds nothing | test/enhance-appearance.test.ts | red: the unknown-root row |

```json
[
 {
  "row": "F10-journal",
  "guard": "the tooltip properties on html are written through the journal",
  "edit": "state.ts writes them with html.style.setProperty / removeProperty",
  "tests": "test/enhance-walls.test.ts, test/enhance-appearance.test.ts",
  "result": "red",
  "file": "src/enhance/state.ts"
 },
 {
  "row": "F10-attr",
  "guard": "the html mark attribute is written through the journal",
  "edit": "state.ts writes it with html.setAttribute / removeAttribute",
  "tests": "test/enhance-appearance.test.ts",
  "result": "red",
  "file": "src/enhance/state.ts"
 },
 {
  "row": "F10-site",
  "guard": "the reach to the document element is one named site, counted",
  "edit": "ALLOWED_SITES state.ts documentElement 1 -> 2",
  "tests": "test/enhance-walls.test.ts",
  "result": "red",
  "file": "test/enhance-walls.test.ts"
 },
 {
  "row": "F10-props",
  "guard": "the journal's closed list holds exactly the three tooltip names",
  "edit": "`--dr-tip-edge` removed from STYLE_PROPS",
  "tests": "test/enhance-appearance.test.ts, test/enhance-seams.test.ts",
  "result": "red",
  "file": "src/enhance/journal.ts"
 },
 {
  "row": "F10-root",
  "guard": "a root that is the document element writes no mark of its own",
  "edit": "`if (html === root) return;` removed",
  "tests": "test/enhance-appearance.test.ts",
  "result": "red",
  "file": "src/enhance/state.ts"
 },
 {
  "row": "F10-frame-wall",
  "guard": "the frame runtime writes no inline style",
  "edit": "enhance-entry.ts wraps setEnhancementAppearance and writes document.documentElement.style.setProperty",
  "tests": "test/frame-runtime-walls.test.ts",
  "result": "red",
  "file": "src/frame-runtime/enhance-entry.ts"
 },
 {
  "row": "F11-entry",
  "guard": "the entry marks nothing before or without the reader",
  "edit": "enhance-entry.ts wraps setEnhancementAppearance and sets the html attribute before the call",
  "tests": "test/enhance-appearance.test.ts",
  "result": "red",
  "file": "src/frame-runtime/enhance-entry.ts"
 },
 {
  "row": "F11-unknown",
  "guard": "an op on a root the reader does not hold leaves html unmarked",
  "edit": "lifecycle.ts setEnhancementAppearance sets the html attribute when findByRoot finds nothing",
  "tests": "test/enhance-appearance.test.ts",
  "result": "red",
  "file": "src/enhance/lifecycle.ts"
 }
]
```
