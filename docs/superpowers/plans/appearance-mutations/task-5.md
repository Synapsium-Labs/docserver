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
  }
]
```
