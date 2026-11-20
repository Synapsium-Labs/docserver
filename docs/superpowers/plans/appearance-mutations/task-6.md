# Task 6 mutation rows (the stylesheet on the slots, and meaning without colour)

Each row mutated `assets/reader.css` (or the named file) in place, one edit at a time (original bytes saved, sha256 checked equal after each restore), and ran `test/browser/appearance-cues.test.ts` filtered to the named test(s) on Chromium (`DOCREADER_BROWSERS=chromium`; WebKit is proven in CI only). A6a and A6b belong to `test/browser/appearance-style.test.ts` (test 4) and are recorded with that file. Rows after A6k guard the other rules this task wrote. The fix round (B1, B2, I3, G1, G2 and the extra gap rows A6c7 and A6c8) redid every row against the final stylesheet: the cues test reads a mutant copy of the stylesheet from the path in DOCREADER_CUES_CSS (set by the runner), so no row ever touched the shared assets/reader.css. Decision recorded for the summary box: .short keeps radiusLarge all round, because its accent edge is a decorative standfirst rule and not an attention mark; .callout.waiting and .rs-wait carry a 3px attention bar and keep it square (0 R R 0).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A6c1 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the double bar of a changed block restored to 1.1.0's single bar | `painted geometry: a changed block` | red |
| A6c2 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the double bar of a changed row restored to a single inset bar | `painted geometry: a changed block` | red |
| A6c3 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the double bar of a stacked changed card restored to a single bar | `painted geometry on a phone` | red |
| A6c4 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the outer run no longer ends where 1.1.0's bar ends (every offset moved 1px) | `outer run ends at the same x` | red |
| A6c5 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the gap in the summary box takes the page ground, not short-bg | `the 2px gap of a changed block` | red |
| A6c6 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the gap in a waiting callout takes the page ground, not wait-soft | `the 2px gap of a changed block` | red |
| A6c7 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the gap in a warning alert takes the page ground, not wait-tint | `the 2px gap of a changed block` | red |
| A6c8 | the changed mark is a double bar: two 2px bars, a 2px gap, its outer edge where 1.1.0's bar ends, the gap in the ground | the gap in a caution alert takes the page ground, not no-tint | `the 2px gap of a changed block` | red |
| A6d1 | status dots and colour-key swatches by shape | the wait dot and swatch are not rings | `four status dots` | red |
| A6d2 | status dots and colour-key swatches by shape | the no and info dots and swatches stay discs | `four status dots` | red |
| A6d3 | status dots and colour-key swatches by shape | the info dot and swatch are not a short bar | `four status dots` | red |
| A6d4 | status dots and colour-key swatches by shape | the swatches have the 1.1.0 rectangle, not their dot shape | `four status dots` | red |
| A6d5 | status dots and colour-key swatches by shape | the wait ring is filled, not hollow | `four status dots` | red |
| A6e1 | a.term dotted and a.xref dashed, kept on hover and while open | the id-link rule loses its specificity (a.xref solid on hover and while a card is open) | `a term is dotted` | red |
| A6e2 | a.term dotted and a.xref dashed, kept on hover and while open | the term rule loses its specificity (a.term solid on hover and while a card is open) | `a term is dotted` | red |
| A6e3 | a.term dotted and a.xref dashed, kept on hover and while open | a.xref not dashed at all | `a term is dotted` | red |
| A6e4 | a.term dotted and a.xref dashed, kept on hover and while open | a.term not dotted again on hover (rule dropped) | `a term is dotted` | red |
| A6f | the quick-jump selected row's bar | the quick-jump selected row loses its bar | `selected row has an inset` | red |
| A6g1 | Aa checked option weight and bar | Aa checked option at 400 | `checked option is at 600` | red |
| A6g2 | Aa checked option weight and bar | Aa checked option without its bar | `checked option is at 600` | red |
| A6g3 | Aa unchecked option weight | Aa unchecked option left at 1.1.0's 600 | `checked option is at 600` | red |
| A6g4 | the pressed view button | the pressed view button at 400 | `pressed view button` | red |
| A6g5 | the pressed view button | the pressed view button without its bar | `pressed view button` | red |
| A6g6 | the pressed view button | the unpressed view button left at 1.1.0's 600 | `pressed view button` | red |
| A6h | the table filter's focus ring | the table filter's focus ring removed | `table filter, focused` | red |
| A6i1 | tints are 4% over their ground | accent-soft a tint at 6% | `every derived colour` | red |
| A6i2 | tints are 4% over their ground | chg-tint a tint at 6% | `every derived colour` | red |
| A6i3 | tints are 4% over their ground | chg-bg inside the summary box a tint at 7% | `chg-bg is 4%` | red |
| A6j | inline code is opaque surface2 | code-inline-bg a tint over surface2 | `every derived colour` | red |
| A6k | selected text is accent / accent-ink | selection back to the literal | `chrome literals` | red |
| D-accent-hover | derived colours, each by its one rule | derived colour accent-hover off its rule | `every derived colour` | red |
| D-th-bg | derived colours, each by its one rule | derived colour th-bg off its rule | `every derived colour` | red |
| D-wait-soft | derived colours, each by its one rule | derived colour wait-soft off its rule | `every derived colour` | red |
| D-wait-tint | derived colours, each by its one rule | derived colour wait-tint off its rule | `every derived colour` | red |
| D-no-tint | derived colours, each by its one rule | derived colour no-tint off its rule | `every derived colour` | red |
| D-chg-soft | derived colours, each by its one rule | derived colour chg-soft off its rule | `every derived colour` | red |
| D-short-bg | derived colours, each by its one rule | derived colour short-bg off its rule | `every derived colour` | red |
| D-paper | derived colours, each by its one rule | derived colour paper off its rule | `every derived colour` | red |
| D-topbar-bg | derived colours, each by its one rule | derived colour topbar-bg off its rule | `every derived colour` | red |
| D-code-comment | derived colours, each by its one rule | derived colour code-comment off its rule | `every derived colour` | red |
| D-plate | derived colours, each by its one rule | the plate of a marked figure not surface | `chg-bg is 4%` | red |
| D-chgbg | derived colours, each by its one rule | chg-bg in the summary box and a waiting callout left at chg-tint | `chg-bg is 4%` | red |
| C-tool-bg | chrome literals are slots | tool button background not surface | `chrome literals` | red |
| C-tool-ink | chrome literals are slots | tool button text not text | `chrome literals` | red |
| C-pressed | chrome literals are slots | pressed tool button not accent/accent-ink | `chrome literals` | red |
| C-overlay | chrome literals are slots | overlay background literal | `chrome literals` | red |
| C-bar | chrome literals are slots | overlay bar text literal | `chrome literals` | red |
| C-obtn | chrome literals are slots | overlay button ground and text literal | `chrome literals` | red |
| C-oedge | chrome literals are slots | overlay button edge literal | `chrome literals` | red |
| W-ink | code on the well | code block and failed-figure text left in text | `code on the well` | red |
| W-plainpre | code on the well | a plain pre > code block (outside .codehilite) left in text | `chg-bg is 4%` | red |
| D-undrawn | derived colours, each by its one rule | an undrawn figure source left on the 1.1.0 plate | `chg-bg is 4%` | red |
| W-sep | code on the well | review strip separator left in rule | `code on the well` | red |
| W-inkgroup | code on the well | the hljs rule "inkgroup" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-comment | code on the well | the hljs rule "comment" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-number | code on the well | the hljs rule "number" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-string | code on the well | the hljs rule "string" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-attr | code on the well | the hljs rule "attr" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-punct | code on the well | the hljs rule "punct" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-function | code on the well | the hljs rule "function" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-type | code on the well | the hljs rule "type" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-keyword | code on the well | the hljs rule "keyword" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-tag | code on the well | the hljs rule "tag" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-deleted | code on the well | the hljs rule "deleted" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-inserted | code on the well | the hljs rule "inserted" dropped (its classes keep 1.1.0's hex) | `code on the well` | red |
| W-deleted-bg | code on the well | a deletion keeps 1.1.0's dark background | `code on the well` | red |
| W-inserted-bg | code on the well | an addition keeps 1.1.0's dark background | `code on the well` | red |
| W-json | code on the well | the json and yaml attr context left on 1.1.0's hex | `code on the well` | green (equivalent mutant) (equivalent mutant: the :is() group keeps the specificity of its other two-class member (.hljs-variable.constant_), so dropping the context pair changes nothing; the rows stay in the rule because the design lists them) |
| W-metakw | code on the well | .hljs-meta .hljs-keyword left on 1.1.0's inherit | `code on the well` | green (equivalent mutant) (equivalent mutant: the group keeps the specificity of .hljs-variable.language_, so the context member adds nothing) |
| W-metastr | code on the well | .hljs-meta .hljs-string left on code-comment | `code on the well` | green (equivalent mutant) (equivalent mutant: the group keeps the specificity of .hljs-char.escape_, so the context member adds nothing) |
| W-tagname | code on the well | .hljs-tag .hljs-name left to syn-punct | `code on the well` | green (equivalent mutant) (equivalent mutant: a name inside a tag is matched by .hljs-name alone, which has the same slot) |
| F-sans | the host faces lead the stacks | sans without the host face | `the faces:` | red |
| F-mono | the host faces lead the stacks | mono without the host face | `the faces:` | red |
| S-radius | skin slots | skin rule radius dropped | `the skin slots style` | red |
| S-radiusSmall | skin slots | skin rule radiusSmall dropped | `the skin slots style` | red |
| S-radiusLarge | skin slots | skin rule radiusLarge dropped | `the skin slots style` | red |
| S-radiusLargeBars | radiusLarge keeps an attention bar square ends | skin rule radiusLargeBars dropped | `radiusLarge keeps the square ends` | red |
| S-controlRow | skin slots | skin rule controlRow dropped | `the skin slots style` | red |
| S-popShadowVar | skin slots | skin rule popShadowVar dropped | `the skin slots style` | red |
| S-popShadowBox | skin slots | skin rule popShadowBox dropped | `popShadow replaces` | red |
| S-sectionSize | skin slots | skin rule sectionSize dropped | `the skin slots style` | red |
| S-sectionWeight | skin slots | skin rule sectionWeight dropped | `the skin slots style` | red |
| S-sectionTracking | skin slots | skin rule sectionTracking dropped | `the skin slots style` | red |
| S-sectionCase | skin slots | skin rule sectionCase dropped | `sectionCase none` | red |
| S-sectionFamily | skin slots | skin rule sectionFamily dropped | `the skin slots style` | red |
| B1a | the frame bar and the reading layout never take a skin value | the frame bar buttons in the radius group | `never take a skin value` | red |
| B1b | the frame bar and the reading layout never take a skin value | every keycap (the bar too) in the small radius group | `never take a skin value` | red |
| B1c | the frame bar and the reading layout never take a skin value | the bar buttons in the controlRow rule | `never take a skin value` | red |
| B2a | the radius slot reaches the painted pre of every code block | the painted pre of a code block left out of the radius group | `the skin slots style` | red |
| B2b | the radius slot reaches the painted pre of every code block | the code wrapper left out of the radius group | `the skin slots style` | red |
| I3a | radiusLarge keeps an attention bar square ends | the attention bars rounded all round by radiusLarge | `radiusLarge keeps the square ends` | red |
| G1 | controlRow and the section type apply to the contents panel only as a drawer | controlRow reaches the contents column, not only the drawer | `only as a drawer` | red |
| G2 | controlRow and the section type apply to the contents panel only as a drawer | the section type reaches the contents column, not only the drawer | `only as a drawer` | red |
| S-drawer | skin slots | the contents drawer keeps its own shadow | `popShadow replaces` | red |
| S-pointer | skin slots | controlRow applied under every pointer | `the family is sans or mono` | red |
| S-attr | skin slots | the reader writes data-docreader-section-family (sans or mono) for the stylesheet to select on | `the skin slots style` | red |

```json
[
 {
  "row": "A6c1",
  "guard": "the double bar of a changed block restored to 1.1.0's single bar",
  "tests": "painted geometry: a changed block",
  "result": "red"
 },
 {
  "row": "A6c2",
  "guard": "the double bar of a changed row restored to a single inset bar",
  "tests": "painted geometry: a changed block",
  "result": "red"
 },
 {
  "row": "A6c3",
  "guard": "the double bar of a stacked changed card restored to a single bar",
  "tests": "painted geometry on a phone",
  "result": "red"
 },
 {
  "row": "A6c4",
  "guard": "the outer run no longer ends where 1.1.0's bar ends (every offset moved 1px)",
  "tests": "outer run ends at the same x",
  "result": "red"
 },
 {
  "row": "A6c5",
  "guard": "the gap in the summary box takes the page ground, not short-bg",
  "tests": "the 2px gap of a changed block",
  "result": "red"
 },
 {
  "row": "A6c6",
  "guard": "the gap in a waiting callout takes the page ground, not wait-soft",
  "tests": "the 2px gap of a changed block",
  "result": "red"
 },
 {
  "row": "A6c7",
  "guard": "the gap in a warning alert takes the page ground, not wait-tint",
  "tests": "the 2px gap of a changed block",
  "result": "red"
 },
 {
  "row": "A6c8",
  "guard": "the gap in a caution alert takes the page ground, not no-tint",
  "tests": "the 2px gap of a changed block",
  "result": "red"
 },
 {
  "row": "A6d1",
  "guard": "the wait dot and swatch are not rings",
  "tests": "four status dots",
  "result": "red"
 },
 {
  "row": "A6d2",
  "guard": "the no and info dots and swatches stay discs",
  "tests": "four status dots",
  "result": "red"
 },
 {
  "row": "A6d3",
  "guard": "the info dot and swatch are not a short bar",
  "tests": "four status dots",
  "result": "red"
 },
 {
  "row": "A6d4",
  "guard": "the swatches have the 1.1.0 rectangle, not their dot shape",
  "tests": "four status dots",
  "result": "red"
 },
 {
  "row": "A6d5",
  "guard": "the wait ring is filled, not hollow",
  "tests": "four status dots",
  "result": "red"
 },
 {
  "row": "A6e1",
  "guard": "the id-link rule loses its specificity (a.xref solid on hover and while a card is open)",
  "tests": "a term is dotted",
  "result": "red"
 },
 {
  "row": "A6e2",
  "guard": "the term rule loses its specificity (a.term solid on hover and while a card is open)",
  "tests": "a term is dotted",
  "result": "red"
 },
 {
  "row": "A6e3",
  "guard": "a.xref not dashed at all",
  "tests": "a term is dotted",
  "result": "red"
 },
 {
  "row": "A6e4",
  "guard": "a.term not dotted again on hover (rule dropped)",
  "tests": "a term is dotted",
  "result": "red"
 },
 {
  "row": "A6f",
  "guard": "the quick-jump selected row loses its bar",
  "tests": "selected row has an inset",
  "result": "red"
 },
 {
  "row": "A6g1",
  "guard": "Aa checked option at 400",
  "tests": "checked option is at 600",
  "result": "red"
 },
 {
  "row": "A6g2",
  "guard": "Aa checked option without its bar",
  "tests": "checked option is at 600",
  "result": "red"
 },
 {
  "row": "A6g3",
  "guard": "Aa unchecked option left at 1.1.0's 600",
  "tests": "checked option is at 600",
  "result": "red"
 },
 {
  "row": "A6g4",
  "guard": "the pressed view button at 400",
  "tests": "pressed view button",
  "result": "red"
 },
 {
  "row": "A6g5",
  "guard": "the pressed view button without its bar",
  "tests": "pressed view button",
  "result": "red"
 },
 {
  "row": "A6g6",
  "guard": "the unpressed view button left at 1.1.0's 600",
  "tests": "pressed view button",
  "result": "red"
 },
 {
  "row": "A6h",
  "guard": "the table filter's focus ring removed",
  "tests": "table filter, focused",
  "result": "red"
 },
 {
  "row": "A6i1",
  "guard": "accent-soft a tint at 6%",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "A6i2",
  "guard": "chg-tint a tint at 6%",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "A6i3",
  "guard": "chg-bg inside the summary box a tint at 7%",
  "tests": "chg-bg is 4%",
  "result": "red"
 },
 {
  "row": "A6j",
  "guard": "code-inline-bg a tint over surface2",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "A6k",
  "guard": "selection back to the literal",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "D-accent-hover",
  "guard": "derived colour accent-hover off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-th-bg",
  "guard": "derived colour th-bg off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-wait-soft",
  "guard": "derived colour wait-soft off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-wait-tint",
  "guard": "derived colour wait-tint off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-no-tint",
  "guard": "derived colour no-tint off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-chg-soft",
  "guard": "derived colour chg-soft off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-short-bg",
  "guard": "derived colour short-bg off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-paper",
  "guard": "derived colour paper off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-topbar-bg",
  "guard": "derived colour topbar-bg off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-code-comment",
  "guard": "derived colour code-comment off its rule",
  "tests": "every derived colour",
  "result": "red"
 },
 {
  "row": "D-plate",
  "guard": "the plate of a marked figure not surface",
  "tests": "chg-bg is 4%",
  "result": "red"
 },
 {
  "row": "D-chgbg",
  "guard": "chg-bg in the summary box and a waiting callout left at chg-tint",
  "tests": "chg-bg is 4%",
  "result": "red"
 },
 {
  "row": "C-tool-bg",
  "guard": "tool button background not surface",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "C-tool-ink",
  "guard": "tool button text not text",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "C-pressed",
  "guard": "pressed tool button not accent/accent-ink",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "C-overlay",
  "guard": "overlay background literal",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "C-bar",
  "guard": "overlay bar text literal",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "C-obtn",
  "guard": "overlay button ground and text literal",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "C-oedge",
  "guard": "overlay button edge literal",
  "tests": "chrome literals",
  "result": "red"
 },
 {
  "row": "W-ink",
  "guard": "code block and failed-figure text left in text",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-plainpre",
  "guard": "a plain pre > code block (outside .codehilite) left in text",
  "tests": "chg-bg is 4%",
  "result": "red"
 },
 {
  "row": "D-undrawn",
  "guard": "an undrawn figure source left on the 1.1.0 plate",
  "tests": "chg-bg is 4%",
  "result": "red"
 },
 {
  "row": "W-sep",
  "guard": "review strip separator left in rule",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-inkgroup",
  "guard": "the hljs rule \"inkgroup\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-comment",
  "guard": "the hljs rule \"comment\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-number",
  "guard": "the hljs rule \"number\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-string",
  "guard": "the hljs rule \"string\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-attr",
  "guard": "the hljs rule \"attr\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-punct",
  "guard": "the hljs rule \"punct\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-function",
  "guard": "the hljs rule \"function\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-type",
  "guard": "the hljs rule \"type\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-keyword",
  "guard": "the hljs rule \"keyword\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-tag",
  "guard": "the hljs rule \"tag\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-deleted",
  "guard": "the hljs rule \"deleted\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-inserted",
  "guard": "the hljs rule \"inserted\" dropped (its classes keep 1.1.0's hex)",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-deleted-bg",
  "guard": "a deletion keeps 1.1.0's dark background",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-inserted-bg",
  "guard": "an addition keeps 1.1.0's dark background",
  "tests": "code on the well",
  "result": "red"
 },
 {
  "row": "W-json",
  "guard": "the json and yaml attr context left on 1.1.0's hex",
  "tests": "code on the well",
  "result": "green (equivalent mutant)",
  "reason": "equivalent mutant: the :is() group keeps the specificity of its other two-class member (.hljs-variable.constant_), so dropping the context pair changes nothing; the rows stay in the rule because the design lists them"
 },
 {
  "row": "W-metakw",
  "guard": ".hljs-meta .hljs-keyword left on 1.1.0's inherit",
  "tests": "code on the well",
  "result": "green (equivalent mutant)",
  "reason": "equivalent mutant: the group keeps the specificity of .hljs-variable.language_, so the context member adds nothing"
 },
 {
  "row": "W-metastr",
  "guard": ".hljs-meta .hljs-string left on code-comment",
  "tests": "code on the well",
  "result": "green (equivalent mutant)",
  "reason": "equivalent mutant: the group keeps the specificity of .hljs-char.escape_, so the context member adds nothing"
 },
 {
  "row": "W-tagname",
  "guard": ".hljs-tag .hljs-name left to syn-punct",
  "tests": "code on the well",
  "result": "green (equivalent mutant)",
  "reason": "equivalent mutant: a name inside a tag is matched by .hljs-name alone, which has the same slot"
 },
 {
  "row": "F-sans",
  "guard": "sans without the host face",
  "tests": "the faces:",
  "result": "red"
 },
 {
  "row": "F-mono",
  "guard": "mono without the host face",
  "tests": "the faces:",
  "result": "red"
 },
 {
  "row": "S-radius",
  "guard": "skin rule radius dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-radiusSmall",
  "guard": "skin rule radiusSmall dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-radiusLarge",
  "guard": "skin rule radiusLarge dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-radiusLargeBars",
  "guard": "skin rule radiusLargeBars dropped",
  "tests": "radiusLarge keeps the square ends",
  "result": "red"
 },
 {
  "row": "S-controlRow",
  "guard": "skin rule controlRow dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-popShadowVar",
  "guard": "skin rule popShadowVar dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-popShadowBox",
  "guard": "skin rule popShadowBox dropped",
  "tests": "popShadow replaces",
  "result": "red"
 },
 {
  "row": "S-sectionSize",
  "guard": "skin rule sectionSize dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-sectionWeight",
  "guard": "skin rule sectionWeight dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-sectionTracking",
  "guard": "skin rule sectionTracking dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "S-sectionCase",
  "guard": "skin rule sectionCase dropped",
  "tests": "sectionCase none",
  "result": "red"
 },
 {
  "row": "S-sectionFamily",
  "guard": "skin rule sectionFamily dropped",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "B1a",
  "guard": "the frame bar buttons in the radius group",
  "tests": "never take a skin value",
  "result": "red"
 },
 {
  "row": "B1b",
  "guard": "every keycap (the bar too) in the small radius group",
  "tests": "never take a skin value",
  "result": "red"
 },
 {
  "row": "B1c",
  "guard": "the bar buttons in the controlRow rule",
  "tests": "never take a skin value",
  "result": "red"
 },
 {
  "row": "B2a",
  "guard": "the painted pre of a code block left out of the radius group",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "B2b",
  "guard": "the code wrapper left out of the radius group",
  "tests": "the skin slots style",
  "result": "red"
 },
 {
  "row": "I3a",
  "guard": "the attention bars rounded all round by radiusLarge",
  "tests": "radiusLarge keeps the square ends",
  "result": "red"
 },
 {
  "row": "G1",
  "guard": "controlRow reaches the contents column, not only the drawer",
  "tests": "only as a drawer",
  "result": "red"
 },
 {
  "row": "G2",
  "guard": "the section type reaches the contents column, not only the drawer",
  "tests": "only as a drawer",
  "result": "red"
 },
 {
  "row": "S-drawer",
  "guard": "the contents drawer keeps its own shadow",
  "tests": "popShadow replaces",
  "result": "red"
 },
 {
  "row": "S-pointer",
  "guard": "controlRow applied under every pointer",
  "tests": "the family is sans or mono",
  "result": "red"
 },
 {
  "row": "S-attr",
  "guard": "the reader writes data-docreader-section-family (sans or mono) for the stylesheet to select on",
  "tests": "the skin slots style",
  "result": "red",
  "file": "src/enhance/state.ts"
 }
]
```

## Test 4 rows (`test/browser/appearance-style.test.ts`): A6a and A6b

Measured on Chromium (`DOCREADER_BROWSERS=chromium`). Each row mutated a scratch copy of `assets/reader.css` (never the file itself: its sha256 was not touched by these rows) and served it through the harness's `stylesheet` option, by `DOCREADER_STYLE_UNDER_TEST=<scratch file>` (the test hands every page that is not given a stylesheet of its own that text). The unmutated stylesheet is green for all the named tests (full file: 3 minutes of tests on Chromium, see the report of the fix round).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A6a-jump | a hosted rule carries its presence attribute (test 4 (a): no appearance, equal to 1.1.0) | the quick-jump selected row's bar loses `[data-docreader-hosted]`: `[data-docreader-root] .jump li.sel { box-shadow: inset 2px 0 0 var(--accent) }` | `-t "corpus/headings\|jump/dialogs\|status-dots"`: seven (a) rows | red: `li.sel: box-shadow: rgb(35, 85, 159) 2px 0px 0px 0px inset -> none`, in the jump, keys and hover states, in the light, system-dark and stored-dark modes |
| A6a-sw | a hosted rule carries its presence attribute (test 4 (a)) | the info swatch and dot height loses `[data-docreader-hosted]`: `[data-docreader-root] :is(.toc-index .dot.info, .ckey .sw.k-info) { height: 3px }` (the size leak the property list could not see before it gained `height`) | the same seven rows | red: `span.sw.k-info: height: 3px -> 10px`, in the Aa menu and the keys sheet |
| A6b-keyword | closed grounds: every `.hljs-*` class takes its slot while coloured (test 4 (c)) | `.hljs-keyword` removed from the keyword rule under `[data-docreader-colours]`, so the class keeps 1.1.0's hex while coloured | `-t "Phosphor & Ink: the representative"` | red (c): seven distinct `span.hljs-keyword` elements in `corpus/fences/main`, each `rgb(255, 123, 114)` on `code-block-bg` (a colour no slot holds) |

```json
[
 {
  "row": "A6a-jump",
  "guard": "a hosted rule carries its presence attribute (test 4 (a))",
  "edit": "the .jump li.sel bar loses [data-docreader-hosted]",
  "tests": "appearance-style.test.ts -t corpus/headings|jump/dialogs|status-dots",
  "result": "red"
 },
 {
  "row": "A6a-sw",
  "guard": "a hosted rule carries its presence attribute (test 4 (a))",
  "edit": "the info swatch and dot height loses [data-docreader-hosted]",
  "tests": "appearance-style.test.ts -t corpus/headings|jump/dialogs|status-dots",
  "result": "red"
 },
 {
  "row": "A6b-keyword",
  "guard": "closed grounds: every .hljs-* class takes its slot while coloured (test 4 (c))",
  "edit": "the .hljs-keyword class left on 1.1.0's hex while coloured",
  "tests": "appearance-style.test.ts -t Phosphor & Ink: the representative",
  "result": "red"
 }
]
```

## Review 2906 F4

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| F4-aa-hosted | the hosted Aa line is drawn in `text-muted` on `bg` (the design, section 6) | the `.aa-menu .aa-hosted` rule removed from assets/reader.css, so the line inherits the menu's `text` colour | `test/browser/appearance-cues.test.ts` (Chromium) | red: the hosted line computed the fixture's `text`, not its `text-muted` |

```json
[
 {
  "row": "F4-aa-hosted",
  "guard": "the hosted Aa line is drawn in text-muted on bg",
  "edit": "the .aa-menu .aa-hosted rule removed",
  "tests": "appearance-cues.test.ts (chromium)",
  "result": "red"
 }
]
```
