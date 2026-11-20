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
| A2j | gitInv follows the series | gitInv<n> set to surface2 again | `test/appearance-mermaid.test.ts` | red (13 failed | 78 passed (91)) |
| A2k | MERMAID_HOSTED_KINDS frozen at ./frame | remove the `Object.freeze(MERMAID_HOSTED_KINDS)` line | `test/appearance-contract.test.ts` | red (1 failed | 129 passed (130)) |
| A2l | lone CR splits statements | split lines at `\n` only | `test/appearance-mermaid.test.ts` | red (1 failed | 90 passed (91)) |
| A2m | br exclusion matches only the element br | br guard back to `(?![a-z])` | `test/appearance-mermaid.test.ts` | red (3 failed | 88 passed (91)) |

A2j to A2m were measured in the fix round (A2k edits one line of `src/frame/appearance.ts` and restores it, sha256 checked).

## Choices

- The derivation table's rows list 124 keys (96 plus 28 series keys); the spec's prose says 110 measured keys. The test asserts the rows as written.
- `gitInv<n>` follows the series, as `git<n>`: Mermaid 12.1.0's `.commit-highlight<n>` (the outer square) reads it; the inner square reads `primaryColor` (`surface2`).
- The `br` exclusion matches only the element `br` (`br` then white space, `/`, `>` or the end).

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
 },
 {
  "row": "A2j",
  "guard": "gitInv follows the series",
  "edit": "gitInv<n> set to surface2 again",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (13 failed | 78 passed (91))"
 },
 {
  "row": "A2k",
  "guard": "MERMAID_HOSTED_KINDS frozen at ./frame",
  "edit": "remove the `Object.freeze(MERMAID_HOSTED_KINDS)` line",
  "tests": "test/appearance-contract.test.ts",
  "result": "red (1 failed | 129 passed (130))"
 },
 {
  "row": "A2l",
  "guard": "lone CR splits statements",
  "edit": "split lines at `\\n` only",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 90 passed (91))"
 },
 {
  "row": "A2m",
  "guard": "br exclusion matches only the element br",
  "edit": "br guard back to `(?![a-z])`",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (3 failed | 88 passed (91))"
 }
]
```
