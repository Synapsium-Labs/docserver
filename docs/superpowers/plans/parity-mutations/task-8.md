# Parity Task 8: mutation rows (test 8's x2 row and the comparison base's label)

Each row was measured in place. P8a and P8b go through `test/size-contract.test.ts`, which reads committed state: the judged commit was a commit made from the landing's tree in a throwaway index (no branch, no second worktree, no repository copy), with `DOCSERVER_SIZE_HEAD` pointing at it, `DOCSERVER_SIZE_BASE=origin/main` and `DOCSERVER_SIZE_TEXT='Size-Design: x2'`; the unmutated tree passes 5 of 5 against `origin/main` and against the tip before the landing. P8c is measured on the working file with its bytes saved and its sha256 compared on restore (`src/enhance/since.ts`, `9fa1e0c6f021d9bbd3559886c957912cd8835450b34e3b8ad8e6723b058cf1f1`).

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P8a | the appended row names a new design, not an old one | the appended row's design is `x1` | `conformance/size/growth.json` | red: 1 failed \| 4 passed (5). every rule of test 8 holds: `x2: the appended row names "x1"` |
| P8b | the landing's text holds exactly one `Size-Design:` line | the text holds two lines, both `Size-Design: x2` | the landing's text | red: 2 failed \| 3 passed (5). the text holds exactly one Size-Design line (2 against 1); every rule of test 8 holds |
| P8c | `baseLabel`'s reverse match takes a commit sha of 7 characters or more, lower-cased | the floor of 7 and the lower-casing removed from the reverse direction | `src/enhance/since.ts` | equivalent mutant, green (20 of 20 in `test/enhance-inshort.test.ts`): `enhance()`'s option check refuses a commit sha under 7 characters and lower-cases every sha it keeps, so `baseLabel` never sees either; the new floor is defence in depth. The case pins both facts at the option check (a 3-character sha is refused; an upper-case 9-character sha still names the base) |

```json
[
  {"id": "P8a", "guard": "the appended row names a new design", "edit": "the appended row's design is x1", "file": "conformance/size/growth.json", "tests": "test/size-contract.test.ts", "rc": 1, "failed": 1, "passed": 4, "total": 5, "red": ["every rule of test 8 holds: x2: the appended row names \"x1\""]},
  {"id": "P8b", "guard": "exactly one Size-Design line", "edit": "two Size-Design lines in the text", "file": "the landing's text", "tests": "test/size-contract.test.ts", "rc": 1, "failed": 2, "passed": 3, "total": 5, "red": ["the text holds exactly one Size-Design line", "every rule of test 8 holds"]},
  {"id": "P8c", "guard": "baseLabel's reverse match floor and lower-casing", "edit": "floor and lower-casing removed", "file": "src/enhance/since.ts", "tests": "test/enhance-inshort.test.ts", "rc": 0, "failed": 0, "passed": 20, "total": 20, "red": [], "equivalent": "unreachable through enhance(): the options check refuses a commit sha under 7 characters and lower-cases it"}
]
```
