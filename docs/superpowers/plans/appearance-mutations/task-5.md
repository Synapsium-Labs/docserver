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
  }
]
```
