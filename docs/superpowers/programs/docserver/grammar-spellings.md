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

**The text applied in the frame.** A colour is applied in one form, lower-case `#rrggbb`, whatever spelling or case arrived. A skin value is applied as received. The brief left this choice open; the coordinator's addendum (point 1) and its clarification closed it, so this is now the contract:

- **Why one form.** The reader, the seed and the Mermaid derivation all read the colour. `mermaidThemeOf` mixes hex channels, its series de-duplicates by lower-cased text, and the seed's longest-text figure counts seven characters a colour.
  - A six-digit hex is lower-cased. This is a change from the candidate's own contract, which kept the case a host wrote.
  - `#rgb` has each digit doubled.
  - A name becomes its colour's hex (`red` is `#ff0000`).
- **Where the lower-casing happens.** `hexOf` returns the table's upper-case hex, and `parseAppearance` lower-cases at the one place that keeps a colour. Lower-casing inside `hexOf` would cost 15 characters more a bundle, which the share does not hold.
- **The seed bound holds.** The longest name is six letters, and it is seeded as seven characters. Every other new spelling is shorter than the spelling the figure counts.
- **Skin values keep their spelling.** The addendum's point 4 asks for one form only where a value is read again after the verdict.
  - Only two skin values are: `controlRow` is compared as text to relayout (`src/enhance/lifecycle.ts`), and `sectionFamily` is written as an attribute (`src/enhance/state.ts`). Neither gains a spelling, and a row per slot shows each value has one accepted spelling.
  - `popShadow` and `sectionTracking`, the two slots that gain spellings, are read by the stylesheet only.
- **Equivalent spellings give the same result.** For a colour they give the same verdict text. For any value they give the same computed values, which the browser gate measures in Chromium: every colour slot as `color`, `letter-spacing` and `box-shadow`, seeded and by an op.

**Contract rows amended (each a spelling D-9019 now accepts, so the row's verdict moved by design):**

- `test/appearance-contract.test.ts`:
  - popShadow `0 0 red` now tests `0 0 blue`, and `0 0 #000` now tests `0 0 #00000`.
  - The colour slots' `#fff` now tests `#ffff`, and `red` now tests `blue`.
  - sectionTracking `.08em` now tests `.0800em`.
  - `0 0 #000000,0 0 #111111` and `0 0 rgba(0,0,0,1)` flip from refused to accepted.
- `test/enhance-appearance.test.ts`: the "bad colour" `red` now uses `blue`.

- **Pinned the received case of a six-digit colour** (moved by the clarification):
  - in `test/appearance-contract.test.ts`, the rows "a full appearance comes back whole…", "every colour slot takes upper and lower case hex", "#2E3440 and #2e3440 pass…" and "leading and trailing U+0020…". The verdict is now lower case in each.
  - in `test/frame-seed.test.ts`, the maximal appearance writes `#abcdef` for `#ABCDEF`.
  - in `test/enhance-appearance.test.ts` (18 rows) and `test/browser/frame-appearance.test.ts`, the rows compared the reader's custom properties with the upper-case palette fixtures (`conformance/appearance/fixtures.json`, 371 upper-case colours). The fixtures are now lower-cased where those two files load them, with a comment; the fixture file is unchanged.

Every other existing row is unchanged and green. No hostile corpus case, bridge case, render golden or layout snapshot moved, and no fixture file changed.

**Pins moved with the assets.** `test/frame-layouts.test.ts` pins the default enhance bundle's sha256, its CSP hash, its length, `MAX_SRCDOC_CHARS_DEFAULT` and the two fixed default srcdocs. All of them move, and the README's quoted policy and the CHANGELOG's hash bullets move with them.

## Size

- **One growth row:** `{"design":"x1","total":5319671,"frame":4580769}`, against `x1`'s share of 32 768 and 32 768.
  - Before this landing x1 had grown 29 982 in both, which left 2 786.
  - This landing adds 2 780 total (5 × 556, one copy in each enhance bundle) and 556 frame. That leaves 6 total and 2 230 frame.
- **Measured against main:** `enhance` 233 003 to 233 559, `enhanceClassic` 149 666 to 150 222, `enhanceEditorial` 170 433 to 170 989, `enhanceReview` 199 525 to 200 081 and `enhanceGuided` 188 635 to 189 191. The bootstrap, guard, stylesheets and Mermaid are unchanged.
- **How it was brought inside the share.** The first build measured 638 characters a bundle (3 190 total, over the share). Behaviour-neutral savings in the same module brought it to 542. The one lower-case form then took it to 556:
  - one shared pixel pattern for the three radii;
  - `\d` for `[0-9]`;
  - a leading `0` sentinel in the table instead of a `(?:^|…)` group;
  - the table's hex in upper case, which separates a name from its hex with no delimiter;
  - `t[4]` instead of `t.length > 4`;
  - `grey` dropped.
- **No headroom left for a later change.** The appearance design now has 6 characters of total share left. A later change to this module needs a new share.

## Mutation rows

Each row was measured in place on this branch, on the final module. For each row:

1. The bytes of `src/enhance/appearance.ts` were saved.
2. One edit was applied.
3. `test/appearance-spellings.test.ts`, `test/appearance-contract.test.ts` and `test/enhance-appearance.test.ts` were run through the fleet test wrapper (`vitest run --maxWorkers=2 --reporter=json`): 601 tests, all green unmutated.
4. The bytes were restored and their sha256 compared: `3408ba74868f499b3865ac4e2a54764270cccc7365d9358f3d8e2c8fe0ef41af`.

Every row exited 1, and every failing test failed with an `AssertionError`; none went red through a load or compile failure. The coordinator's in-memory mutation helper takes Python modules only, so it does not apply here.

| Row | Guard | Edit | Result |
|---|---|---|---|
| S1 | colour: the 3-digit hex alternative | `/^#(?:[\dA-Fa-f]{3}){1,2}$/` to `/^#(?:[\dA-Fa-f]{3}){2}$/` | red: 108 of 601 failed, AssertionError |
| S2 | colour: a 3-digit hex is doubled to its six-digit form | `return t[4] ? t : t.replace(/\w/g, '$&$&');` to `return t;` | red: 107 of 601 failed, AssertionError |
| S3 | colour: the name alternative | `const m = /^[a-z]+$/.test(t) ?` to `const m = false ?` | red: 142 of 601 failed, AssertionError |
| S4 | colour: a name is letters only before it enters a pattern | `const m = /^[a-z]+$/.test(t) ?` to `const m = /^\S+$/.test(t) ?` | red: 6 of 601 failed, AssertionError |
| S5 | colour: a name starts after a hex digit of the table | `new RegExp(`[\\dA-F]${t}([\\dA-F]{6})`)` to `new RegExp(`${t}([\\dA-F]{6})`)` | red: 2 of 601 failed, AssertionError |
| S6 | colour: a name ends before six hex digits of the table | `new RegExp(`[\\dA-F]${t}([\\dA-F]{6})`)` to `new RegExp(`[\\dA-F]${t}(\\w{6})`)` | red: 1 of 601 failed, AssertionError |
| S7 | colour: a name gives its colour's hex | `return m === null ? '' : `#${m[1] as string}`;` to `return m === null ? '' : t;` | red: 105 of 601 failed, AssertionError |
| S8 | colour: the verdict holds the six-digit form | `if (why === '') g[s] = c;` to `if (why === '') g[s] = t;` | red: 210 of 601 failed, AssertionError |
| S9 | colour: the table holds tan | `tanD2B48C` to `(removed)` | red: 37 of 601 failed, AssertionError |
| S10 | colour: the table holds no other name (blue added) | `0azureF0FFFF` to `0azureF0FFFFblue0000FF` | red: 8 of 601 failed, AssertionError |
| S11 | popShadow: the 3- and 4-digit hex alternative | `\|${h}{6}\|${h}{3,4})` to `\|${h}{6})` | red: 8 of 601 failed, AssertionError |
| S12 | popShadow: the 4-digit (alpha) short hex | `\|${h}{6}\|${h}{3,4})` to `\|${h}{6}\|${h}{3})` | red: 3 of 601 failed, AssertionError |
| S13 | popShadow: the name alternative | `\\)\|([a-z]+))`;` to `\\)\|(\\b\\B))`;` | red: 36 of 601 failed, AssertionError |
| S14 | popShadow: a name must be in the table | `if (m[8] !== undefined && hexOf(m[8]) === '') return 'grammar';` to `(removed)` | red: 11 of 601 failed, AssertionError |
| S15 | popShadow: grammar wins over range | `Math.max(r as number, g as number, b as number) > 255) why = 'range';` to `Math.max(r as number, g as number, b as number) > 255) return 'range';` | red: 1 of 601 failed, AssertionError |
| S16 | popShadow: rgba first comma takes no space | `rgba\\(${int}, ?${int}` to `rgba\\(${int}, ${int}` | red: 7 of 601 failed, AssertionError |
| S17 | popShadow: rgba second comma takes no space | `${int}, ?${int}, ?${int}, ?(?:0\|1` to `${int}, ?${int}, ${int}, ?(?:0\|1` | red: 8 of 601 failed, AssertionError |
| S18 | popShadow: rgba alpha comma takes no space | `${int}, ?(?:0\|1` to `${int}, (?:0\|1` | red: 7 of 601 failed, AssertionError |
| S19 | popShadow: rgba alpha without its leading zero | `0?\\.\\d{1,3}\|1` to `0\\.\\d{1,3}\|1` | red: 7 of 601 failed, AssertionError |
| S20 | popShadow: a list comma takes no space | `if (!new RegExp(`^${one}(?:, ?${one}){0,2}$`)` to `if (!new RegExp(`^${one}(?:, ${one}){0,2}$`)` | red: 5 of 601 failed, AssertionError |
| S21 | popShadow: the walk steps over a comma with or without its space | `new RegExp(`${one},? ?`, 'y')` to `new RegExp(`${one},?`, 'y')` | red: 8 of 601 failed, AssertionError |
| S22 | sectionTracking: a length without its leading zero | `/^-?(?:0\|0?\.\d{1,3})em$/` to `/^-?(?:0\|0\.\d{1,3})em$/` | red: 11 of 601 failed, AssertionError |
| S23 | sectionTracking: no wider than three decimals in the short spelling | `/^-?(?:0\|0?\.\d{1,3})em$/` to `/^-?(?:0\|0?\.\d{1,4})em$/` | red: 3 of 601 failed, AssertionError |
| S24 | sectionTracking: a point needs a digit after it | `/^-?(?:0\|0?\.\d{1,3})em$/` to `/^-?(?:0\|0?\.\d{0,3})em$/` | red: 2 of 601 failed, AssertionError |
| S25 | colour: the hex pattern is anchored to the whole value (no line mode) | `/^#(?:[\dA-Fa-f]{3}){1,2}$/.test(t)` to `/^#(?:[\dA-Fa-f]{3}){1,2}$/m.test(t)` | red: 3 of 601 failed, AssertionError |
| S26 | colour: the verdict lower-cases the six-digit form, the one form | `hexOf(t).toLowerCase() : t;` to `hexOf(t) : t;` | red: 130 of 601 failed, AssertionError |

**What guards what.**

- S4 is the injection guard. A name reaches a `RegExp` only after `/^[a-z]+$/`; without that check, `re.`, `[a-z]+`, `red|blue`, `(red)`, `#f/**/ff` and `re/**/d` are accepted or throw.
- S5 and S6 hold a name to a whole run of the table, so a prefix (`re`) or a suffix (`ed`) of a name is refused.
- S2, S7, S8 and S26 also red the addendum's rows: Mermaid's derivation of a short, an upper-case and a named colour; the derived tints; the series; the seed text; and the one form.

**One row not counted as measured.** The seed-bound row in `test/frame-document.test.ts` checks a seed built from six-letter names and compact skin values: every colour seeded as lower-case `#rrggbb`, the seed equal to the one the six-digit spellings give, its text shorter than the longest appearance's. It goes red under these mutants, but through a `FrameError`, not its own assertions. `frameDocument` checks the bundle built from the mutated source against the committed manifest and refuses it before the assertions run. Its claim rests on the verdict, which the spelling table's seed-text row guards.

## Measurement

- **Unit:** the new file runs 377 rows; the whole unit suite (6 543 tests) passes at the final module. The appearance, Mermaid-derivation, seed, frame-layout, README, package and size-rule suites pass.
- **Browser:** `test/browser/frame-appearance.test.ts` passes in Chromium, the new row included. WebKit cannot launch on the worker box, so no case ran in WebKit locally; the hosted CI runs both.
- **The first full run** (every vitest group, browser cases in Chromium) passed 7 278 tests in 190 of 200 files. One file, `test/frame-document.test.ts`, did not run to the end: the test slice's memory cap killed its worker (`write EPIPE` from esbuild; the slice reported 16 OOM kills, shared with other runs). Run alone, the file passed its first 145 tests and was killed again. Its 13 rows whose titles name the appearance pass alone (`-t appearance`), the old-cap row with the largest accepted appearance among them. The file's whole result is unmeasured here, and the hosted CI run measures it.
- **Hosted CI on the first push** (`2ddc50b`, before the addendum): `test (22)` and `test (24)` passed, each running every group with Chromium and WebKit, `test/frame-document.test.ts` included. The old-cap gate was skipped: it runs only on a manual dispatch. The fingerprint's own checks are the ones on the final head.
- **Timing row:** `test/enhance-services.test.ts` "terms: defining is linear" failed once inside a parallel full unit run and passed three of three alone. It measures the glossary, which this landing does not touch.

## Review before the commit

One adversarial review of the diff, Opus at high effort, attacked the grammar as an injection surface.

- **No injection and no correctness bug found.** Exactly the 31 whole names are accepted out of every lower-case substring of the table. Look-alike and case-folding names are refused (`RED`, the Kelvin sign, `ſnow`, `İ`, `constructor`, `__proto__`). `new RegExp` cannot throw on an input that has passed `/^[a-z]+$/`. Inputs of 8 000 characters run in 1 ms or less.
- **The walk matched the old validator.** 2 000 000 random token strings produced no throw. 500 000 structured lists, each rewritten to its long spelling and judged by the old `popShadow` from `main`, gave no mismatch.
- **Two minor test gaps, both fixed.**
  - The Kelvin-sign row was plain ASCII; it is now `\u212Ahaki`.
  - No row put white space other than U+0020 around a short colour. Five rows were added (a line feed after and before `#fff`, a tab before `red`, a no-break space after it, U+2028 after `#fff`), guarded by S25.

## Second review (the addendum's round)

A second review, Opus at high effort, read this round's change against the addendum. It found all four points met and every number in the README, the CHANGELOG and this note right. It caught one thing: a draft that lower-cased inside `hexOf` cost 15 characters more a bundle (2 855 total, 69 over the share). The final module lower-cases at the call site instead, at 556 a bundle. It also suggested a stronger seed row, which compares with the six-digit spellings' seed and is in.

## Third review (the final colour path)

A focused review, Opus at high effort, read the final lower-casing after the coordinator's clarification.

- **No Critical or Important finding.** Every colour the verdict returns is lower-case `#rrggbb`. `popShadow` uses the name table only for membership. Nothing in `src/` compares a colour with the host's text or depends on its case.
- **Three Minor points.**
  - With the fixtures lower-cased at load, no jsdom row sent a colour the verdict rewrites through `enhance()`. Now one does: `#ABCDEF`, `#FFF` and `tan` are written as `#abcdef`, `#ffffff` and `#d2b48c`.
  - The frame-document seed row built its six-digit comparison by parsing twice. It now uses a literal name-to-hex map. A typecheck error in the first version of that row is fixed with it.
  - The "one form" row repeats the doubling rule. Literal rows cover that independently, so it is kept as it is.


The first claim covered the module, the assets, the tables, the docs, the new test file and the browser test. Four amended test files were edited before the claim was extended to them: `test/frame-layouts.test.ts`, `test/appearance-contract.test.ts`, `test/enhance-appearance.test.ts` and `test/frame-seed.test.ts`. The extended claim does not backdate the edits.

## The console's side

The first consumer's design text (§2's grammar) is amended on the console side, not here.
