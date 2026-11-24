# The appearance grammars take a minifier's spellings (lib-grammar-spellings): notes for the ledger

What the programme ledger should learn from this landing, for the coordinator to fold in. One pull request from `main` at `996a39b` (the 1.2.0 candidate's preparation). Nothing is tagged or published, and every version surface stays 1.2.0.

## Why

A host reads its palette from its own custom properties and forwards that text verbatim, as the contract asks. The first consumer's production build minifies its stylesheet with Lightning CSS 1.32.0. Measured over every palette, both skins and both pointer kinds (2 408 slot rows), 96 values were refused. 40 were `#FFFFFF` arriving as `#fff` in three colour slots, and one refused colour drops the whole colour group. The other 56 were `sectionTracking` without its leading zero (`-.011em`, `.08em`). Case-only changes (1 720 rows) and the alpha hex inside `popShadow` (28) were already accepted.

What the same minifier writes inside a custom property, measured here on version 1.32.0 (a probe outside the work tree; the library takes no dependency on it):

- `#ffffff` becomes `#fff`, `#00000088` becomes `#0008`, `#000000ff` becomes `#000`, and `#ff000080` is kept.
- 31 colours become names: `#ff0000` becomes `red`, `#f0ffff` becomes `azure`, and so on.
- `rgba(0, 0, 0, 0.1)` becomes `#0000001a`. With a legacy target it becomes `rgba(0,0,0,.1)` (no spaces, no leading zero), and `#00000088` becomes `rgba(0,0,0,.533)`.
- `-0.011em` becomes `-.011em`, `0.080em` becomes `.08em`, `-0.100em` becomes `-.1em`, and `0.000em` becomes `0em`.
- `12PX` becomes `12px`, `0ms` becomes `0s`, and runs of spaces collapse.
- `0px`, `0em` and `0%` are kept, and so is the `, ` between shadows of a list that had it.

## D-9019 (issued by the coordinator for this landing): the grammar text moves

The contract's written grammars (§2 of the first consumer's appearance design, the README's appearance contract, `src/enhance/appearance.ts`) are widened to the equivalent spellings above, and to nothing that is not equivalent to an acceptable value. Exactly:

- **A colour slot** takes `#rrggbb` and `#rgb`, in either case, and the 31 names below in lower case. An alpha form (`#rgba`, `#rrggbbaa`) stays refused: the slots are opaque.
- **`popShadow`'s colour** takes a hex of 3, 4, 6 or 8 digits, the same 31 names, or `rgba(` with one space or none after each comma and an alpha of `0`, `1`, `0.d{1,3}`, `.d{1,3}` or `1.0{1,3}`. The list comma takes one space or none. Lengths and every range are unchanged, and a range applies to the parsed value. A name outside the table is `grammar` wherever it stands, even after a shadow that is out of range.
- **`sectionTracking`** takes `-?(0|0?.d{1,3})em`: the leading zero may go. The range is unchanged and is read from the parsed value (`.301em` and `-.101em` are `range`).
- **Unchanged:** the other skin slots, the slots themselves, the group rule (a colour group is all or nothing), the refusal words, the size stop and the payload limits.
- **Still refused:** every other CSS name (`blue`, `grey`, `rebeccapurple`), `transparent`, `currentcolor`, the CSS-wide keywords, a name in another case, `rgb()`, `hsl()` and every other function. Also refused: white space other than the single optional space after a comma, a trailing semicolon, an embedded comment, `1.em`, `-.em` and a unitless `.5`.

**The name table, and what it costs.** It is the CSS names shorter than every hex spelling of their colour (32 of 148), less `grey`. A minifier writes a name only where it is shorter than the hex it replaces, and for `#808080` Lightning CSS writes `gray`, never `grey`. That gives 31 names, the same set the probe measured: `azure`, `beige`, `bisque`, `brown`, `coral`, `gold`, `gray`, `green`, `indigo`, `ivory`, `khaki`, `linen`, `maroon`, `navy`, `olive`, `orange`, `orchid`, `peru`, `pink`, `plum`, `purple`, `red`, `salmon`, `sienna`, `silver`, `snow`, `tan`, `teal`, `tomato`, `violet` and `wheat`. The table, with each name's hex, is 341 characters in each enhance bundle, five bundles. The whole named set (148 names) would be 2 211 characters a bundle, 11 055 in total, far beyond the appearance design's remaining share. `grey` was dropped for size: 10 characters a bundle, 50 in total.

**The text applied in the frame.** A colour is applied in its six-digit form, and a skin value as received:

- A colour must be in six-digit form because the reader computes with it: the Mermaid derivation (`mermaidThemeOf`) mixes hex channels.
  - `#rrggbb` is kept as written, case included, as 1.2.0 already did.
  - `#rgb` has each digit doubled, its case kept.
  - A name becomes its colour's hex in upper case (`red` is `#FF0000`). Upper case is the table's own spelling; a lower-casing call would cost 14 characters a bundle.
- A skin value is kept as received (`-.011em`, `0 0 rgba(0,0,0,.5)`), because only the stylesheet reads it.
- Two equivalent spellings give the same computed values. The browser gate measures this in Chromium: every colour slot as `color`, `letter-spacing` and `box-shadow`, seeded and by an op. Equivalent spellings give the same verdict text for a colour, up to case.

**Contract rows amended (each a spelling D-9019 now accepts, so the row's verdict moved by design):**

- `test/appearance-contract.test.ts`:
  - popShadow `0 0 red` now tests `0 0 blue`, and `0 0 #000` now tests `0 0 #00000`.
  - The colour slots' `#fff` now tests `#ffff`, and `red` now tests `blue`.
  - sectionTracking `.08em` now tests `.0800em`.
  - `0 0 #000000,0 0 #111111` and `0 0 rgba(0,0,0,1)` flip from refused to accepted.
- `test/enhance-appearance.test.ts`: the "bad colour" `red` now uses `blue`.

Every other existing row is unchanged and green. No hostile corpus case, bridge case, render golden or layout snapshot moved.

**Pins moved with the assets.** `test/frame-layouts.test.ts` pins the default enhance bundle's sha256, its CSP hash, its length, `MAX_SRCDOC_CHARS_DEFAULT` and the two fixed default srcdocs. All of them move, and the README's quoted policy and the CHANGELOG's hash bullets move with them.

## Size

- **One growth row:** `{"design":"x1","total":5319601,"frame":4580755}`, against `x1`'s share of 32 768 and 32 768.
  - Before this landing x1 had grown 29 982 in both, which left 2 786.
  - This landing adds 2 710 total (5 × 542, one copy in each enhance bundle) and 542 frame. That leaves 76 total and 2 244 frame.
- **Measured against main:** `enhance` 233 003 to 233 545, `enhanceClassic` 149 666 to 150 208, `enhanceEditorial` 170 433 to 170 975, `enhanceReview` 199 525 to 200 067 and `enhanceGuided` 188 635 to 189 177. The bootstrap, guard, stylesheets and Mermaid are unchanged.
- **How it was brought inside the share.** The first build measured 638 characters a bundle (3 190 total, over the share). Behaviour-neutral savings in the same module brought it to 542:
  - one shared pixel pattern for the three radii;
  - `\d` for `[0-9]`;
  - a leading `0` sentinel in the table instead of a `(?:^|…)` group;
  - names giving upper-case hex instead of lower-casing it;
  - `t[4]` instead of `t.length > 4`;
  - `grey` dropped.
- **No headroom left for a later change.** The appearance design now has 76 characters of total share left. A later change to this module needs a new share.

## Mutation rows

Each row was measured in place on this branch. For each row:

1. The bytes of `src/enhance/appearance.ts` were saved.
2. One edit was applied.
3. `test/appearance-spellings.test.ts`, `test/appearance-contract.test.ts` and `test/enhance-appearance.test.ts` were run through the fleet test wrapper (`vitest run --maxWorkers=2 --reporter=json`).
4. The bytes were restored and their sha256 compared: `f3acadcd81e5d155837c3606dba1d31808a6a1bcea641eb2ca1a797cba59dad1`, the module at the time of the run.

Every row exited 1, and every failing test failed with an `AssertionError`; none went red through a load or compile failure. The three files run 577 tests unmutated, all green. The coordinator's in-memory mutation helper takes Python modules only, so it does not apply here.

| Row | Guard | Edit | Result |
|---|---|---|---|
| S1 | colour: the 3-digit hex alternative | `/^#(?:[\dA-Fa-f]{3}){1,2}$/` to `/^#(?:[\dA-Fa-f]{3}){2}$/` | red: 103 of 577 failed, AssertionError; first: D-9019: every colour slot takes the short spellings of an opaque colour, in their six-digit form bg: an opaque short hex, lower case (#fff) is accepted and gives the verdict of #ffffff |
| S2 | colour: a 3-digit hex is doubled to its six-digit form | `return t[4] ? t : t.replace(/\w/g, '$&$&');` to `return t;` | red: 102 of 577 failed, AssertionError; first: D-9019: every colour slot takes the short spellings of an opaque colour, in their six-digit form bg: an opaque short hex, lower case (#fff) is accepted and gives the verdict of #ffffff |
| S3 | colour: the name alternative | `const m = /^[a-z]+$/.test(t) ?` to `const m = false ?` | red: 136 of 577 failed, AssertionError; first: D-9019: every colour slot takes the short spellings of an opaque colour, in their six-digit form bg: a name for an opaque colour (red) is accepted and gives the verdict of #FF0000 |
| S4 | colour: a name is letters only before it enters a pattern | `const m = /^[a-z]+$/.test(t) ?` to `const m = /^\S+$/.test(t) ?` | red: 6 of 577 failed, AssertionError; first: D-9019: the near misses stay refused, with the same refusal words colour slot: a short hex with an embedded comment (#f/**/ff) is refused by grammar and drops the group |
| S5 | colour: a name starts after a hex digit of the table | `new RegExp(`[\\dA-F]${t}([\\dA-F]{6})`)` to `new RegExp(`${t}([\\dA-F]{6})`)` | red: 2 of 577 failed, AssertionError; first: D-9019: the near misses stay refused, with the same refusal words colour slot: a prefix of a name (re) is refused by grammar and drops the group |
| S6 | colour: a name ends before six hex digits of the table | `new RegExp(`[\\dA-F]${t}([\\dA-F]{6})`)` to `new RegExp(`[\\dA-F]${t}(\\w{6})`)` | red: 1 of 577 failed, AssertionError; first: D-9019: the near misses stay refused, with the same refusal words colour slot: a prefix of a name (re) is refused by grammar and drops the group |
| S7 | colour: a name gives its colour's hex | `return m === null ? '' : `#${m[1] as string}`;` to `return m === null ? '' : t;` | red: 100 of 577 failed, AssertionError; first: D-9019: every colour slot takes the short spellings of an opaque colour, in their six-digit form bg: a name for an opaque colour (red) is accepted and gives the verdict of #FF0000 |
| S8 | colour: the verdict holds the six-digit form | `if (why === '') g[s] = c;` to `if (why === '') g[s] = t;` | red: 199 of 577 failed, AssertionError; first: D-9019: every colour slot takes the short spellings of an opaque colour, in their six-digit form bg: an opaque short hex, lower case (#fff) is accepted and gives the verdict of #ffffff |
| S9 | colour: the table holds tan | `tanD2B48C` to `(removed)` | red: 36 of 577 failed, AssertionError; first: D-9019: every colour slot takes the short spellings of an opaque colour, in their six-digit form bg: a name whose colour has no short hex (tan) is accepted and gives the verdict of #D2B48C |
| S10 | colour: the table holds no other name (blue added) | `0azureF0FFFF` to `0azureF0FFFFblue0000FF` | red: 8 of 577 failed, AssertionError; first: test 1: parseAppearance leaves out what the grammar refuses, naming each popShadow with a named colour outside the name table (D-9019) is left out and named |
| S11 | popShadow: the 3- and 4-digit hex alternative | `\|${h}{6}\|${h}{3,4})` to `\|${h}{6})` | red: 7 of 577 failed, AssertionError; first: D-9019: popShadow takes the spellings a minifier writes for its colours and its lists an opaque short hex: 0 0 #000 is accepted as received, as its long spelling 0 0 #000000 is |
| S12 | popShadow: the 4-digit (alpha) short hex | `\|${h}{6}\|${h}{3,4})` to `\|${h}{6}\|${h}{3})` | red: 2 of 577 failed, AssertionError; first: D-9019: popShadow takes the spellings a minifier writes for its colours and its lists an alpha short hex: 0 0 #0008 is accepted as received, as its long spelling 0 0 #00000088 is |
| S13 | popShadow: the name alternative | `\\)\|([a-z]+))`;` to `\\)\|(\\b\\B))`;` | red: 35 of 577 failed, AssertionError; first: D-9019: popShadow takes the spellings a minifier writes for its colours and its lists a name: 0 1px 2px red is accepted as received, as its long spelling 0 1px 2px #ff0000 is |
| S14 | popShadow: a name must be in the table | `if (m[8] !== undefined && hexOf(m[8]) === '') return 'grammar';` to `(removed)` | red: 11 of 577 failed, AssertionError; first: test 1: parseAppearance leaves out what the grammar refuses, naming each popShadow with a named colour outside the name table (D-9019) is left out and named |
| S15 | popShadow: grammar wins over range | `Math.max(r as number, g as number, b as number) > 255) why = 'range';` to `Math.max(r as number, g as number, b as number) > 255) return 'range';` | red: 1 of 577 failed, AssertionError; first: D-9019: popShadow takes the spellings a minifier writes for its colours and its lists every range applies to the parsed value of the short spellings too |
| S16 | popShadow: rgba first comma takes no space | `rgba\\(${int}, ?${int}` to `rgba\\(${int}, ${int}` | red: 6 of 577 failed, AssertionError; first: test 1: whitespace and digits refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row |
| S17 | popShadow: rgba second comma takes no space | `${int}, ?${int}, ?${int}, ?(?:0\|1` to `${int}, ?${int}, ${int}, ?(?:0\|1` | red: 7 of 577 failed, AssertionError; first: test 1: whitespace and digits refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row |
| S18 | popShadow: rgba alpha comma takes no space | `${int}, ?(?:0\|1` to `${int}, (?:0\|1` | red: 6 of 577 failed, AssertionError; first: test 1: whitespace and digits refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row |
| S19 | popShadow: rgba alpha without its leading zero | `0?\\.\\d{1,3}\|1` to `0\\.\\d{1,3}\|1` | red: 6 of 577 failed, AssertionError; first: D-9019: popShadow takes the spellings a minifier writes for its colours and its lists an rgba alpha without its leading zero: 0 0 rgba(0,0,0,.5) is accepted as received, as its long spelling 0 0 rgba(0, 0, 0, 0.5) is |
| S20 | popShadow: a list comma takes no space | `if (!new RegExp(`^${one}(?:, ?${one}){0,2}$`)` to `if (!new RegExp(`^${one}(?:, ${one}){0,2}$`)` | red: 4 of 577 failed, AssertionError; first: test 1: whitespace and digits refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row |
| S21 | popShadow: the walk steps over a comma with or without its space | `new RegExp(`${one},? ?`, 'y')` to `new RegExp(`${one},?`, 'y')` | red: 8 of 577 failed, AssertionError; first: test 1: parseAppearance accepts the edges of every grammar skin popShadow accepts 0 0 #000000, 1px 1px 1px #111111, -2px -2px 2px 2px rgba(1, 2, 3, 0.5) |
| S22 | sectionTracking: a length without its leading zero | `/^-?(?:0\|0?\.\d{1,3})em$/` to `/^-?(?:0\|0\.\d{1,3})em$/` | red: 10 of 577 failed, AssertionError; first: D-9019: sectionTracking takes a length without its leading or trailing zeros -.011em is accepted as received, and stands for the value of -0.011em |
| S23 | sectionTracking: no wider than three decimals in the short spelling | `/^-?(?:0\|0?\.\d{1,3})em$/` to `/^-?(?:0\|0?\.\d{1,4})em$/` | red: 3 of 577 failed, AssertionError; first: test 1: parseAppearance leaves out what the grammar refuses, naming each every other skin slot refuses a value outside its pattern |
| S24 | sectionTracking: a point needs a digit after it | `/^-?(?:0\|0?\.\d{1,3})em$/` to `/^-?(?:0\|0?\.\d{0,3})em$/` | red: 2 of 577 failed, AssertionError; first: D-9019: the near misses stay refused, with the same refusal words sectionTracking: a sign and a point with no digit (-.em) is refused, as grammar |
| S25 | colour: the hex pattern is anchored to the whole value (no line mode) | `/^#(?:[\dA-Fa-f]{3}){1,2}$/.test(t)` to `/^#(?:[\dA-Fa-f]{3}){1,2}$/m.test(t)` | red: 3 of 582 failed, AssertionError; first: colour slot: a short hex with a trailing line feed (`#fff\n`) is refused by grammar and drops the group |

Rows S1 to S24 were measured with 577 tests in the three files. S25 guards the rows the review added and was measured after them, with 582.

S4 is the injection guard: a name reaches a `RegExp` only after `/^[a-z]+$/`. Without the guard, `re.`, `[a-z]+`, `red|blue`, `(red)`, `#f/**/ff` and `re/**/d` are accepted or throw. S5 and S6 hold a name to a whole run of the table, so a prefix (`re`) or a suffix (`ed`) of a name is refused.

## Measurement

- **Unit:** the new file runs 358 rows. The appearance, Mermaid-derivation, seed, frame-layout, README, package and size-rule suites pass.
- **Browser:** `test/browser/frame-appearance.test.ts` passes in Chromium, the new row included. WebKit cannot launch on the worker box, so no case ran in WebKit locally; the hosted CI runs both.
- **The first full run** (every vitest group, browser cases in Chromium) passed 7 278 tests in 190 of 200 files. One file, `test/frame-document.test.ts`, did not run to the end: the test slice's memory cap killed its worker (`write EPIPE` from esbuild; the slice reported 16 OOM kills, shared with other runs). Run alone, the file passed its first 145 tests and was killed again. Its 13 rows whose titles name the appearance pass alone (`-t appearance`), the old-cap row with the largest accepted appearance among them. The file's whole result is unmeasured here, and the hosted CI run measures it.
- **Timing row:** `test/enhance-services.test.ts` "terms: defining is linear" failed once inside a parallel full unit run and passed three of three alone. It measures the glossary, which this landing does not touch.

## Review before the commit

One adversarial review of the diff, Opus at high effort, attacked the grammar as an injection surface.

- **No injection and no correctness bug found.** Exactly the 31 whole names are accepted out of every lower-case substring of the table. Look-alike and case-folding names are refused (`RED`, the Kelvin sign, `ſnow`, `İ`, `constructor`, `__proto__`). `new RegExp` cannot throw on an input that has passed `/^[a-z]+$/`. Inputs of 8 000 characters run in 1 ms or less.
- **The walk matched the old validator.** 2 000 000 random token strings produced no throw. 500 000 structured lists, each rewritten to its long spelling and judged by the old `popShadow` from `main`, gave no mismatch.
- **Two minor test gaps, both fixed.**
  - The Kelvin-sign row was plain ASCII; it is now `\u212Ahaki`.
  - No row put white space other than U+0020 around a short colour. Five rows were added (a line feed after and before `#fff`, a tab before `red`, a no-break space after it, U+2028 after `#fff`), guarded by S25.

## Ownership

The first claim covered the module, the assets, the tables, the docs, the new test file and the browser test. Three amended test files (`test/frame-layouts.test.ts`, `test/appearance-contract.test.ts`, `test/enhance-appearance.test.ts`) were edited before the claim was extended to them; the extended claim does not backdate the edits.

## The console's side

The first consumer's design text (§2's grammar) is amended on the console side, not here.
