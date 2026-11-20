# Task 2 mutation rows (the Mermaid derivation and the author-styled scan)

Each row mutated `src/enhance/appearance-mermaid.ts` in place (original bytes saved, sha256 `e37d14c9...3f1a` checked after each restore), one at a time.

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A2a | exactly the table's keys | drop `pieStrokeColor` from the surface row | `test/appearance-mermaid.test.ts` | red (13 failed | 72 passed (85)) |
| A2b | lineColor from text-muted | move `lineColor` from the text-muted row to the border row | `test/appearance-mermaid.test.ts` | red (13 failed | 72 passed (85)) |
| A2c | series de-duplication | push every series colour, no skip | `test/appearance-mermaid.test.ts` | red (16 failed | 69 passed (85)) |
| A2d | case-insensitive heads | drop the `i` flag of the head pattern | `test/appearance-mermaid.test.ts` | red (3 failed | 82 passed (85)) |
| A2e | `;` splits statements | split at line breaks only | `test/appearance-mermaid.test.ts` | red (1 failed | 84 passed (85)) |
| A2f | leading tab trim | trim leading spaces only, not tabs | `test/appearance-mermaid.test.ts` | red (1 failed | 84 passed (85)) |
| A2g | `<<` is not an element | drop the not-after-`<` guard | `test/appearance-mermaid.test.ts` | red (2 failed | 83 passed (85)) |
| A2h | todayMarker head | remove `todayMarker` from the heads | `test/appearance-mermaid.test.ts` | red (2 failed | 83 passed (85)) |
| A2i | dropShadow fixed key | leave `dropShadow` out | `test/appearance-mermaid.test.ts` | red (2 failed | 83 passed (85)) |

```json
[
 {
  "row": "A2a",
  "guard": "exactly the table's keys",
  "edit": "drop `pieStrokeColor` from the surface row",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (13 failed | 72 passed (85))"
 },
 {
  "row": "A2b",
  "guard": "lineColor from text-muted",
  "edit": "move `lineColor` from the text-muted row to the border row",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (13 failed | 72 passed (85))"
 },
 {
  "row": "A2c",
  "guard": "series de-duplication",
  "edit": "push every series colour, no skip",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (16 failed | 69 passed (85))"
 },
 {
  "row": "A2d",
  "guard": "case-insensitive heads",
  "edit": "drop the `i` flag of the head pattern",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (3 failed | 82 passed (85))"
 },
 {
  "row": "A2e",
  "guard": "`;` splits statements",
  "edit": "split at line breaks only",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 84 passed (85))"
 },
 {
  "row": "A2f",
  "guard": "leading tab trim",
  "edit": "trim leading spaces only, not tabs",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 84 passed (85))"
 },
 {
  "row": "A2g",
  "guard": "`<<` is not an element",
  "edit": "drop the not-after-`<` guard",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (2 failed | 83 passed (85))"
 },
 {
  "row": "A2h",
  "guard": "todayMarker head",
  "edit": "remove `todayMarker` from the heads",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (2 failed | 83 passed (85))"
 },
 {
  "row": "A2i",
  "guard": "dropShadow fixed key",
  "edit": "leave `dropShadow` out",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (2 failed | 83 passed (85))"
 }
]
```
