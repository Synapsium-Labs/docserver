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

## Review 2906 F5

Review 2906 found three families the scan missed (ccrc D-8826 ruled that the scan widens, erring toward author-styled). The scan now reads a head after the text's start, white space, `;` or a closing `}`, and before white space, `;`, `:` or the end; spares only a `<<name>>` annotation under the `<` rule; and scans the text without its `%%{ ... }%%` init directives (so a directive's `themeCSS` naming `rect` does not make the covered directive fixtures author-styled; an unclosed directive is not stripped). The rows were measured on `src/enhance/appearance-mermaid.ts` (original bytes saved, sha256 `7f696591...1f69` checked after each restore). The red-first run of the new test rows against the previous scan: 14 failed | 111 passed (125). Rows A2e to A2h, A2l and A2m above describe the previous scan; A2v to A2x re-measure the guards that remain, and A2y and A2z replace A2e and A2l. The totals differ only by rows added after the first measurements (134, then 136 in all).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A2n | heads after a closing token or white space | scan prefix back to `(?:^|[\n;])[^\S\n]*` | `test/appearance-mermaid.test.ts` | red (8 failed | 126 passed (134)) |
| A2o | `rect:` and every head end at a colon | drop `:` from the head's follow set | `test/appearance-mermaid.test.ts` | red (3 failed | 131 passed (134)) |
| A2p | a closing `}` starts a statement | drop `}` from the prefix set | `test/appearance-mermaid.test.ts` | red (1 failed | 133 passed (134)) |
| A2q | only `<<name>>` is spared by the `<` rule | `<` rule back to `(?:^|[^<])<` with no annotation strip | `test/appearance-mermaid.test.ts` | red (3 failed | 131 passed (134)) |
| A2r | the annotation strip | drop the `.replace` of `<<name>>` | `test/appearance-mermaid.test.ts` | red (7 failed | 127 passed (134)) |
| A2s | the annotation name's alphabet | name class `[\w-]*` to `[\w ]*` | `test/appearance-mermaid.test.ts` | red (1 failed | 133 passed (134)) |
| A2t | a directive's text is no style | scan the body without stripping the init directives | `test/appearance-mermaid.test.ts` | red (2 failed | 132 passed (134)) |
| A2u | an unclosed directive keeps what follows | `withoutDirectives` drops the tail when no directive is open | `test/appearance-mermaid.test.ts` | red (52 failed | 82 passed (134)) |
| A2v | case-insensitive heads (re-measured) | drop the `i` flag of the head pattern | `test/appearance-mermaid.test.ts` | red (3 failed | 131 passed (134)) |
| A2w | todayMarker head (re-measured) | remove `todayMarker` from the heads | `test/appearance-mermaid.test.ts` | red (2 failed | 132 passed (134)) |
| A2x | br exclusion (re-measured) | br guard to `(?![a-z])` | `test/appearance-mermaid.test.ts` | red (19 failed | 115 passed (134)) |
| A2y | `;` starts a statement with no space after it | drop `;` from the prefix set | `test/appearance-mermaid.test.ts` | red (1 failed | 135 passed (136)) |
| A2z | lone CR ends a front-matter line | split lines at `\n` and `\r\n` only | `test/appearance-mermaid.test.ts` | red (1 failed | 135 passed (136)) |

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
 },
 {
  "row": "A2n",
  "guard": "heads after a closing token or white space",
  "edit": "scan prefix back to `(?:^|[\\n;])[^\\S\\n]*`",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (8 failed | 126 passed (134))"
 },
 {
  "row": "A2o",
  "guard": "`rect:` and every head end at a colon",
  "edit": "drop `:` from the head's follow set",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (3 failed | 131 passed (134))"
 },
 {
  "row": "A2p",
  "guard": "a closing `}` starts a statement",
  "edit": "drop `}` from the prefix set",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 133 passed (134))"
 },
 {
  "row": "A2q",
  "guard": "only `<<name>>` is spared by the `<` rule",
  "edit": "`<` rule back to `(?:^|[^<])<` with no annotation strip",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (3 failed | 131 passed (134))"
 },
 {
  "row": "A2r",
  "guard": "the annotation strip",
  "edit": "drop the `.replace` of `<<name>>`",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (7 failed | 127 passed (134))"
 },
 {
  "row": "A2s",
  "guard": "the annotation name's alphabet",
  "edit": "name class `[\\w-]*` to `[\\w ]*`",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 133 passed (134))"
 },
 {
  "row": "A2t",
  "guard": "a directive's text is no style",
  "edit": "scan the body without stripping the init directives",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (2 failed | 132 passed (134))"
 },
 {
  "row": "A2u",
  "guard": "an unclosed directive keeps what follows",
  "edit": "`withoutDirectives` drops the tail when no directive is open",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (52 failed | 82 passed (134))"
 },
 {
  "row": "A2v",
  "guard": "case-insensitive heads (re-measured)",
  "edit": "drop the `i` flag of the head pattern",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (3 failed | 131 passed (134))"
 },
 {
  "row": "A2w",
  "guard": "todayMarker head (re-measured)",
  "edit": "remove `todayMarker` from the heads",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (2 failed | 132 passed (134))"
 },
 {
  "row": "A2x",
  "guard": "br exclusion (re-measured)",
  "edit": "br guard to `(?![a-z])`",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (19 failed | 115 passed (134))"
 },
 {
  "row": "A2y",
  "guard": "`;` starts a statement with no space after it",
  "edit": "drop `;` from the prefix set",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 135 passed (136))"
 },
 {
  "row": "A2z",
  "guard": "lone CR ends a front-matter line",
  "edit": "split lines at `\\n` and `\\r\\n` only",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 135 passed (136))"
 }
]
```

## Second review F1

The scan's directive exclusion is now Mermaid 12.1.0's own `directiveRegex`, copied exactly (`%%{`, white space, a word with or without a `:`, a value up to `}%%`); a match Mermaid does not close with `}%%` stays in the scan, and a closed match is removed to the empty string as Mermaid removes it. The sixteen probes of the review are cases (twelve drew styled and scanned plain before; the new cases are red against the previous scan: 13 failed of the first batch). Rows measured on `src/enhance/appearance-mermaid.ts` (original bytes saved, sha256 checked after each restore), tests run `test/appearance-mermaid.test.ts`.

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A2R1 | a directive is only what Mermaid 12.1.0 removes (its grammar, not any `%%{` to the next `}%%`) | `withoutDirectives` back to `body.replace(/%%\{[^]*?\}%%/g, ' ')` | `test/appearance-mermaid.test.ts` | red (16 failed | 142 passed (158)) |
| A2R2 | a directive never closed keeps what follows in the scan | the replacement removes every match, closed or not | `test/appearance-mermaid.test.ts` | red (1 failed | 157 passed (158)) |
| A2R3 | a directive is removed to the empty string, as Mermaid removes it | the replacement is a space for a closed match | `test/appearance-mermaid.test.ts` | red (1 failed | 157 passed (158)) |
| A2R4 | the init directives leave the scan (test 5 directive fixtures) | `withoutDirectives` returns the body unchanged | `test/appearance-mermaid.test.ts` | red (5 failed | 153 passed (158)) |
| A2R5 | `%%{` needs white space and a word after it | the grammar's `(\w+)` after `%%{\s*` made `(\w*)` (a bare `%%{"` starts a directive) | `test/appearance-mermaid.test.ts` | red (13 failed | 145 passed (158)) |

```json
[
 {
  "row": "A2R1",
  "guard": "a directive is only what Mermaid 12.1.0 removes (its grammar, not any `%%{` to the next `}%%`)",
  "edit": "`withoutDirectives` back to `body.replace(/%%\\{[^]*?\\}%%/g, ' ')`",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (16 failed | 142 passed (158))"
 },
 {
  "row": "A2R2",
  "guard": "a directive never closed keeps what follows in the scan",
  "edit": "the replacement removes every match, closed or not",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 157 passed (158))"
 },
 {
  "row": "A2R3",
  "guard": "a directive is removed to the empty string, as Mermaid removes it",
  "edit": "the replacement is a space for a closed match",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (1 failed | 157 passed (158))"
 },
 {
  "row": "A2R4",
  "guard": "the init directives leave the scan (test 5 directive fixtures)",
  "edit": "`withoutDirectives` returns the body unchanged",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (5 failed | 153 passed (158))"
 },
 {
  "row": "A2R5",
  "guard": "`%%{` needs white space and a word after it",
  "edit": "the grammar's `(\\w+)` after `%%{\\s*` made `(\\w*)` (a bare `%%{\"` starts a directive)",
  "tests": "test/appearance-mermaid.test.ts",
  "result": "red (13 failed | 145 passed (158))"
 }
]
```
