# Appearance Task 1: mutation rows (the contract and its validator)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, `test/appearance-contract.test.ts` run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared. The restore sha256 of `src/enhance/appearance.ts` is `c41c688a43d97c003203c1340785bbbffa19d17db9305e62a7a73798fce587e7`, and of `src/frame/appearance.ts` (rows A1u to A1w) `a7120332d721c5bc14a35a14fd7d0e8ff042a9eef696c6f23ffd15ffa46894f6`. Every row exited 1 and every failing test failed with an `AssertionError`; none went red through a load or compile failure. Rows A1a to A1n are the plan's; A1o to A1r are the review's fix round (its items 1 and 2), A1s and A1t guard the group-first ordering and the symbol keys, and A1u to A1w the freeze at the `./frame` boundary. The file runs 133 tests unmutated, all green. Every row was measured again after the fix round changed `read()`, `parseAppearance` and the header.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| A1a | outer spaces only | `trim()` also treats a tab as an outer space (both loops) | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: whitespace and digits a tab is not an outer space (a tab around a value refuses it) |
| A1b | single inner space | the shadow pattern admits one or two spaces between its first two lengths | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: whitespace and digits refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row |
| A1c | popShadow ranges | blur ceiling 64 -> 65 | `src/enhance/appearance.ts` | red: 3 failed \| 126 passed (129). test 1: parseAppearance leaves out what the grammar refuses, naming each popShadow with a blur of 65 is left out and named; test 1: parseAppearance leaves out what the grammar refuses, naming each names the why: an out-of-range length is range, a shape the grammar does not have is grammar; test 1: every shadow is range-checked, and the edges of every range refuses a range error in the 2nd or 3rd shadow, and in an rgba of a later shadow |
| A1d | colour all or nothing | a group with a refused value keeps its valid slots | `src/enhance/appearance.ts` | red: 5 failed \| 124 passed (129). test 1: parseAppearance leaves out what the grammar refuses, naming each colour slots refuse a 3-digit hex, rgb(), var(, url(, a semicolon and an out-of-range length, each named, without throwing; test 1: parseAppearance never throws a BigInt in a colour slot drops the colour group, naming the slot; test 1: same-realm values a getter in a colour slot is refused without being called; and 2 more |
| A1e | incomplete group | a colour group missing `rule` counts as complete | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: a missing slot, and all or nothing a colour group holding every slot but rule is refused whole, as incomplete |
| A1f | accessor never called | `own()` reads `g[k]` instead of the descriptor | `src/enhance/appearance.ts` | red: 4 failed \| 125 passed (129). test 1: same-realm values a getter in a colour slot is refused without being called; test 1: same-realm values a getter in the skin, in mode and in label is refused without being called; test 1: same-realm values a getter in a group slot is not called either when it is the group itself; and 1 more |
| A1g | key count first | the 64-key stop applies only when every value is a string (types judged first) | `src/enhance/appearance.ts` | red: 3 failed \| 126 passed (129). test 1: same-realm values a colour of 65 keys, none of them strings, is refused whole as too-many-keys, with at most 64 entries; test 1: same-realm values a top level of 65 keys gives auto and one too-many-keys; test 1: symbol keys symbol keys count toward the 64-key cap, with the string keys |
| A1h | size cap | cap 8192 -> 8193 (`n > 8193`) | `src/enhance/appearance.ts` | red: 3 failed \| 126 passed (129). test 1: size a value whose walk counts 8 192 code units is judged slot by slot; one counting 8 193 is refused whole; test 1: size keys count, in groups too, and a refused unknown key still counts; test 1: size the sum runs across the groups, so many small values refuse whole |
| A1i | unreadable | a throw other than the size stop propagates (the walk is not guarded) | `src/enhance/appearance.ts` | red: 2 failed \| 127 passed (129). test 1: same-realm values a Proxy whose ownKeys trap throws, and a revoked Proxy, each give auto and unreadable; test 1: same-realm values a throw of the string a size stop would use is still unreadable (the stop is a private object) |
| A1j | label categories | `\p{Cf}` dropped from the refused categories | `src/enhance/appearance.ts` | red: 3 failed \| 126 passed (129). test 6 (validator half): the label U+0000, U+001B, U+007F, U+0085, U+202E and U+2066 are refused; test 6 (validator half): the label by category, not by list: U+061C, U+206A, U+00AD, U+E0041, U+2028, U+2029 and a lone U+D800 are refused; test 6 (validator half): the label a label does not make the colour group or the skin refuse, and the reverse |
| A1k | label length in code units | length counted in code points (`[...v].length`) | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 6 (validator half): the label astral characters count twice: 32 of them (64 units) show, 33 (66 units) are refused |
| A1l | strings only | a number is read as its text, so the number 600 passes for `sectionWeight` | `src/enhance/appearance.ts` | red: 2 failed \| 127 passed (129). test 1: the forms the first consumer sends the strings "10px", "600" and "-0.011em" pass; the numbers 10 and 600 do not; test 1: a missing slot, and all or nothing two refused colours name both |
| A1m | sectionTracking digits | four decimals allowed (`{1,4}`) | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: whitespace and digits refuses an alpha of 0.5555, and a sectionTracking of 0.0800em |
| A1n | the pairs product | every pair on a tint ground removed (75 entries: 14 text colours and the focus ring on each of the five tints) | `src/enhance/appearance.ts` | red: 3 failed \| 126 passed (129). the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing; APPEARANCE_PAIRS (section 5, the contrast gate) is the product: 14 text colours on 8 grounds, the well, accent-ink on accent at 4.5, and the focus ring on the 8 grounds at 3; APPEARANCE_PAIRS (section 5, the contrast gate) draws no pair on border or rule, no text on a ground that does not admit it, and no focus ring on the well or accent |
| A1o | every shadow range-checked | the range check reads the first shadow only (the walk ends after it) | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: every shadow is range-checked, and the edges of every range refuses a range error in the 2nd or 3rd shadow, and in an rgba of a later shadow |
| A1p | sectionTracking upper bound | upper bound 0.3 -> 0.35 | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: every shadow is range-checked, and the edges of every range sectionTracking: 0.3em and -0.1em pass, 0.301em and -0.101em are refused as range |
| A1q | sectionTracking lower bound | lower bound -0.1 -> -0.15 | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: every shadow is range-checked, and the edges of every range sectionTracking: 0.3em and -0.1em pass, 0.301em and -0.101em are refused as range |
| A1r | radiusLarge range | radiusLarge ceiling 24 -> 30 | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: every shadow is range-checked, and the edges of every range radiusLarge: 0px and 24px pass, 25px is refused as range |
| A1s | a group-level entry first | the colour group's `incomplete` is appended last instead of first, so the cap of 64 can cut it | `src/enhance/appearance.ts` | red: 1 failed \| 128 passed (129). test 1: same-realm values a group of exactly 64 keys is read, with at most 64 entries |
| A1t | symbol keys counted | symbol keys left out of the key list (not counted toward 64, not named) | `src/enhance/appearance.ts` | red: 2 failed \| 127 passed (129). test 1: symbol keys a symbol key is refused as unknown-key, named (symbol), and never read; test 1: symbol keys symbol keys count toward the 64-key cap, with the string keys |
| A1u | pairs frozen at ./frame | the per-pair freeze removed (`src/frame/appearance.ts`) | `src/frame/appearance.ts` | red: 3 failed \| 126 passed (129). the contract at the ./frame boundary is frozen APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen; the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing; APPEARANCE_PAIRS (section 5, the contrast gate) is the product: 14 text colours on 8 grounds, the well, accent-ink on accent at 4.5, and the focus ring on the 8 grounds at 3 |
| A1v | slot arrays frozen at ./frame | the colour array's freeze removed (`src/frame/appearance.ts`) | `src/frame/appearance.ts` | red: 2 failed \| 127 passed (129). the contract at the ./frame boundary is frozen APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen; the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing |
| A1w | APPEARANCE_SLOTS frozen at ./frame | the record's freeze removed (`src/frame/appearance.ts`) | `src/frame/appearance.ts` | red: 2 failed \| 127 passed (129). the contract at the ./frame boundary is frozen APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen; the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing |

## Choices

- **An unknown key in `colour`** (`colour.<key>`) is refused and named as `unknown-key`, and the group stands when all 33 slots are valid: an unknown key is not a refused colour slot, so it does not trigger the all-or-nothing rule. In `skin` and at the top level an unknown key is likewise refused alone.
- **Symbol keys** count toward the 64-key cap with the string keys, are never read (no descriptor, so no accessor is called), and are refused as `unknown-key` with the fixed key spelling `(symbol)` (`skin.(symbol)`, `colour.(symbol)` inside a group). The key list is `Object.getOwnPropertyNames` plus `Object.getOwnPropertySymbols`; `Reflect.ownKeys` would give the same list, but `Reflect` is a name the reader's walls refuse in `src/enhance`.
- **The refusal key scheme:** `mode`, `label`, `colour` and `skin` (a whole group), `colour.<slot>` and `skin.<slot>` (one value), a bare key for an unknown top-level key, `(symbol)`, and `*` for the whole value. A group-level entry (`incomplete`) comes first among its group's entries, so the cap of 64 entries a group never cuts it. The `why` words are the closed union `AppearanceRefusalWhy`.
- **The pattern is the range** where the design's pattern already bounds it (`sectionSize` `1[0-6]px`, `sectionWeight` `[1-9]00`): a value outside is `grammar`. Where the pattern is looser than the range (radii, `controlRow`, `sectionTracking`, the `popShadow` lengths and integers) a value outside is `range`.
- **Frozen at the boundary:** `src/enhance/appearance.ts` holds no top-level call (its walls), so its lists are typed readonly there; `src/frame/appearance.ts` freezes `APPEARANCE_SLOTS`, its two arrays, `APPEARANCE_PAIRS` and every pair in place, and `./frame` re-exports from it.

```json
[
  {
    "id": "A1a",
    "guard": "outer spaces only",
    "edit": "`trim()` also treats a tab as an outer space (both loops)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: whitespace and digits a tab is not an outer space (a tab around a value refuses it)"
    ]
  },
  {
    "id": "A1b",
    "guard": "single inner space",
    "edit": "the shadow pattern admits one or two spaces between its first two lengths",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: whitespace and digits refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row"
    ]
  },
  {
    "id": "A1c",
    "guard": "popShadow ranges",
    "edit": "blur ceiling 64 -> 65",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 126,
    "total": 129,
    "red": [
      "test 1: parseAppearance leaves out what the grammar refuses, naming each popShadow with a blur of 65 is left out and named",
      "test 1: parseAppearance leaves out what the grammar refuses, naming each names the why: an out-of-range length is range, a shape the grammar does not have is grammar",
      "test 1: every shadow is range-checked, and the edges of every range refuses a range error in the 2nd or 3rd shadow, and in an rgba of a later shadow"
    ]
  },
  {
    "id": "A1d",
    "guard": "colour all or nothing",
    "edit": "a group with a refused value keeps its valid slots",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 124,
    "total": 129,
    "red": [
      "test 1: parseAppearance leaves out what the grammar refuses, naming each colour slots refuse a 3-digit hex, rgb(), var(, url(, a semicolon and an out-of-range length, each named, without throwing",
      "test 1: parseAppearance never throws a BigInt in a colour slot drops the colour group, naming the slot",
      "test 1: same-realm values a getter in a colour slot is refused without being called",
      "test 1: a missing slot, and all or nothing one refused colour leaves out the whole colour group, and every other colour with it",
      "test 1: a missing slot, and all or nothing two refused colours name both"
    ]
  },
  {
    "id": "A1e",
    "guard": "incomplete group",
    "edit": "a colour group missing `rule` counts as complete",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: a missing slot, and all or nothing a colour group holding every slot but rule is refused whole, as incomplete"
    ]
  },
  {
    "id": "A1f",
    "guard": "accessor never called",
    "edit": "`own()` reads `g[k]` instead of the descriptor",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 125,
    "total": 129,
    "red": [
      "test 1: same-realm values a getter in a colour slot is refused without being called",
      "test 1: same-realm values a getter in the skin, in mode and in label is refused without being called",
      "test 1: same-realm values a getter in a group slot is not called either when it is the group itself",
      "test 1: same-realm values a Proxy whose ownKeys trap throws, and a revoked Proxy, each give auto and unreadable"
    ]
  },
  {
    "id": "A1g",
    "guard": "key count first",
    "edit": "the 64-key stop applies only when every value is a string (types judged first)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 126,
    "total": 129,
    "red": [
      "test 1: same-realm values a colour of 65 keys, none of them strings, is refused whole as too-many-keys, with at most 64 entries",
      "test 1: same-realm values a top level of 65 keys gives auto and one too-many-keys",
      "test 1: symbol keys symbol keys count toward the 64-key cap, with the string keys"
    ]
  },
  {
    "id": "A1h",
    "guard": "size cap",
    "edit": "cap 8192 -> 8193 (`n > 8193`)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 126,
    "total": 129,
    "red": [
      "test 1: size a value whose walk counts 8 192 code units is judged slot by slot; one counting 8 193 is refused whole",
      "test 1: size keys count, in groups too, and a refused unknown key still counts",
      "test 1: size the sum runs across the groups, so many small values refuse whole"
    ]
  },
  {
    "id": "A1i",
    "guard": "unreadable",
    "edit": "a throw other than the size stop propagates (the walk is not guarded)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 127,
    "total": 129,
    "red": [
      "test 1: same-realm values a Proxy whose ownKeys trap throws, and a revoked Proxy, each give auto and unreadable",
      "test 1: same-realm values a throw of the string a size stop would use is still unreadable (the stop is a private object)"
    ]
  },
  {
    "id": "A1j",
    "guard": "label categories",
    "edit": "`\\p{Cf}` dropped from the refused categories",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 126,
    "total": 129,
    "red": [
      "test 6 (validator half): the label U+0000, U+001B, U+007F, U+0085, U+202E and U+2066 are refused",
      "test 6 (validator half): the label by category, not by list: U+061C, U+206A, U+00AD, U+E0041, U+2028, U+2029 and a lone U+D800 are refused",
      "test 6 (validator half): the label a label does not make the colour group or the skin refuse, and the reverse"
    ]
  },
  {
    "id": "A1k",
    "guard": "label length in code units",
    "edit": "length counted in code points (`[...v].length`)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 6 (validator half): the label astral characters count twice: 32 of them (64 units) show, 33 (66 units) are refused"
    ]
  },
  {
    "id": "A1l",
    "guard": "strings only",
    "edit": "a number is read as its text, so the number 600 passes for `sectionWeight`",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 127,
    "total": 129,
    "red": [
      "test 1: the forms the first consumer sends the strings \"10px\", \"600\" and \"-0.011em\" pass; the numbers 10 and 600 do not",
      "test 1: a missing slot, and all or nothing two refused colours name both"
    ]
  },
  {
    "id": "A1m",
    "guard": "sectionTracking digits",
    "edit": "four decimals allowed (`{1,4}`)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: whitespace and digits refuses an alpha of 0.5555, and a sectionTracking of 0.0800em"
    ]
  },
  {
    "id": "A1n",
    "guard": "the pairs product",
    "edit": "every pair on a tint ground removed (75 entries: 14 text colours and the focus ring on each of the five tints)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 126,
    "total": 129,
    "red": [
      "the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing",
      "APPEARANCE_PAIRS (section 5, the contrast gate) is the product: 14 text colours on 8 grounds, the well, accent-ink on accent at 4.5, and the focus ring on the 8 grounds at 3",
      "APPEARANCE_PAIRS (section 5, the contrast gate) draws no pair on border or rule, no text on a ground that does not admit it, and no focus ring on the well or accent"
    ]
  },
  {
    "id": "A1o",
    "guard": "every shadow range-checked",
    "edit": "the range check reads the first shadow only (the walk ends after it)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: every shadow is range-checked, and the edges of every range refuses a range error in the 2nd or 3rd shadow, and in an rgba of a later shadow"
    ]
  },
  {
    "id": "A1p",
    "guard": "sectionTracking upper bound",
    "edit": "upper bound 0.3 -> 0.35",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: every shadow is range-checked, and the edges of every range sectionTracking: 0.3em and -0.1em pass, 0.301em and -0.101em are refused as range"
    ]
  },
  {
    "id": "A1q",
    "guard": "sectionTracking lower bound",
    "edit": "lower bound -0.1 -> -0.15",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: every shadow is range-checked, and the edges of every range sectionTracking: 0.3em and -0.1em pass, 0.301em and -0.101em are refused as range"
    ]
  },
  {
    "id": "A1r",
    "guard": "radiusLarge range",
    "edit": "radiusLarge ceiling 24 -> 30",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: every shadow is range-checked, and the edges of every range radiusLarge: 0px and 24px pass, 25px is refused as range"
    ]
  },
  {
    "id": "A1s",
    "guard": "a group-level entry first",
    "edit": "the colour group's `incomplete` is appended last instead of first, so the cap of 64 can cut it",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 128,
    "total": 129,
    "red": [
      "test 1: same-realm values a group of exactly 64 keys is read, with at most 64 entries"
    ]
  },
  {
    "id": "A1t",
    "guard": "symbol keys counted",
    "edit": "symbol keys left out of the key list (not counted toward 64, not named)",
    "file": "src/enhance/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 127,
    "total": 129,
    "red": [
      "test 1: symbol keys a symbol key is refused as unknown-key, named (symbol), and never read",
      "test 1: symbol keys symbol keys count toward the 64-key cap, with the string keys"
    ]
  },
  {
    "id": "A1u",
    "guard": "pairs frozen at ./frame",
    "edit": "the per-pair freeze removed (`src/frame/appearance.ts`)",
    "file": "src/frame/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 126,
    "total": 129,
    "red": [
      "the contract at the ./frame boundary is frozen APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen",
      "the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing",
      "APPEARANCE_PAIRS (section 5, the contrast gate) is the product: 14 text colours on 8 grounds, the well, accent-ink on accent at 4.5, and the focus ring on the 8 grounds at 3"
    ]
  },
  {
    "id": "A1v",
    "guard": "slot arrays frozen at ./frame",
    "edit": "the colour array's freeze removed (`src/frame/appearance.ts`)",
    "file": "src/frame/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 127,
    "total": 129,
    "red": [
      "the contract at the ./frame boundary is frozen APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen",
      "the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing"
    ]
  },
  {
    "id": "A1w",
    "guard": "APPEARANCE_SLOTS frozen at ./frame",
    "edit": "the record's freeze removed (`src/frame/appearance.ts`)",
    "file": "src/frame/appearance.ts",
    "tests": "test/appearance-contract.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 127,
    "total": 129,
    "red": [
      "the contract at the ./frame boundary is frozen APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen",
      "the contract at the ./frame boundary is frozen writing through the ./frame import throws in strict mode, and changes nothing"
    ]
  }
]
```
