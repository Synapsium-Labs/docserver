# Task 7 mutation rows (Mermaid while hosted: classification, redraw, cue colours, hosted rules)

Each row mutated the named file in place, one edit at a time (original bytes saved, sha256 checked equal after each restore), and ran the named tests: `test/enhance-appearance-mermaid.test.ts` (jsdom, a fake Mermaid with `parse`) and `test/browser/appearance-mermaid-draw.test.ts` (Chromium, `DOCREADER_BROWSERS=chromium`, the real bundled Mermaid; WebKit is proven in CI only). A7a, A7b, A7g, A7k and A7l belong to test 5's own file (`test/browser/appearance-mermaid.test.ts`) and were run there, through the harness's stylesheet option (a mutated copy of assets/reader.css served in place of the file; assets/ itself untouched) or, for A7a, by mutating src/enhance/appearance-mermaid.ts in place with its sha256 checked after restore. Rows A7q to A7v guard this task's other behaviour (renamed from A7k to A7p in the run logs: the coordinator's cherry-pick ruling took A7k and A7l).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A7c | the 3px surface halo behind sequence message and loop labels | the halo rule (`:is(.messageText, .loopText, .loopText > tspan)`) removed from assets/reader.css | test/browser/appearance-mermaid-draw.test.ts: the first test (halo: computed stroke surface, width 3px) | red |
| A7d | the stick half arrowheads in text-muted | the `marker path[stroke="black"]` rule removed from assets/reader.css | test/browser/appearance-mermaid-draw.test.ts: both tests (the figure's markers and the full-screen copy's draw rgb(0, 0, 0)) | red |
| A7e | no drop-shadow filter on a hosted drawing's elements | the `[filter*="drop-shadow"] { filter: none }` rule removed from assets/reader.css | test/browser/appearance-mermaid-draw.test.ts: the first test (computed filters of the marked drawings: 4 elements keep a filter) | red |
| A7f | cue colours: the verdict's focus, accent and bg on a hosted figure | the three cue paints written as 1.1.0's literals again in src/enhance/diagram-tools.ts | test/enhance-appearance-mermaid.test.ts (row A7f), test/browser/appearance-mermaid-draw.test.ts: the first test (ring stroke rgb(11, 107, 102)) | red |
| A7h | an author-styled figure draws as 1.1.0 draws it | the author-styled scan skipped in src/enhance/diagrams.ts (`f.cover ??= await covered(...)`) | test/enhance-appearance-mermaid.test.ts (classification), test/browser/appearance-mermaid-draw.test.ts: the first test (the author-styled flowchart carries the mark) | red |
| A7i | a newer appearance cancels the redraws an older one queued | both generation checks removed from `follow` in src/enhance/diagrams.ts | test/enhance-appearance-mermaid.test.ts (row A7i: 6 redraws, not 4) | red |
| A7j | a kind outside the constant draws as 1.1.0 draws it | `covered` answers yes for any kind `parse` names (src/enhance/diagrams.ts) | test/enhance-appearance-mermaid.test.ts (4 rows), test/browser/appearance-mermaid-draw.test.ts: the first test (the journey carries the mark) | red |
| A7q | with no colours there is no parse call | the colours test before classification replaced by `true` (src/enhance/diagrams.ts) | test/enhance-appearance-mermaid.test.ts (no parse call; colours arriving on a mount) | red |
| A7r | the figure tools follow a redrawn svg | the rebuild of the tools for a new svg disabled in src/enhance/diagram-tools.ts | test/enhance-appearance-mermaid.test.ts (the tools follow the new drawing: Full screen copies the old svg and its mark) | red |
| A7s | the full-screen stage is `surface` for a hosted figure | the `.fo-stage:has(> svg[data-docreader-hosted-figure])` rule removed from assets/reader.css | test/browser/appearance-mermaid-draw.test.ts: the full-screen test (stage plate is 1.1.0's rgb(31, 31, 31)) | red |
| A7t | no filter on a hosted drawing, in the figure and in the overlay | the `--fig-filter: none` rule removed from assets/reader.css | test/browser/appearance-mermaid-draw.test.ts: both tests (invert(0.88) hue-rotate(180deg) on the marked svg) | red |
| A7u | the drawing is marked `data-docreader-hosted-figure` | the svg mark never written (src/enhance/diagrams.ts) | test/enhance-appearance-mermaid.test.ts (6 rows), test/browser/appearance-mermaid-draw.test.ts: both tests | red |
| A7v | a change redraws only the figures it affects | every started figure redrawn on any change (src/enhance/diagrams.ts) | test/enhance-appearance-mermaid.test.ts (an appearance that removes the colours: 4 renders, not 3) | red |
| A7k | the cherry-pick disc is text-muted | the `circle.commit-cherry-pick:not([fill])` rule removed from assets/reader.css (the disc draws black), served through the harness's stylesheet option | test/browser/appearance-mermaid.test.ts: the gitGraph marks row (disc not text-muted, marks 1:1 or worse on it) and closed colours: gitgraph (disc paint) | red |
| A7l | the disc rule never reaches a mark | the disc rule widened to every `.commit-cherry-pick` (selector `circle.commit-cherry-pick:not([fill])` replaced by `.commit-cherry-pick`), served through the harness's stylesheet option | test/browser/appearance-mermaid.test.ts: the gitGraph marks row (dots and stems on a text-muted disc at 1:1) and closed colours: gitgraph (a mark painted text-muted) | red |
| A7a | mermaidThemeOf drops one key | `lineColor` removed from the text-muted row of the derivation table in src/enhance/appearance-mermaid.ts (sha256 checked equal after restore); then, for a key outside `THEME_VARIABLES`, `gridColor` removed from the `rule` row | test/browser/appearance-mermaid.test.ts: every key assigned (the first: `THEME_VARIABLES key lineColor`; the second: `gantt: keys drawn but not assigned: [gridColor]`) | red |
| A7b | the commit-label rule | the `.commit-label-bkg { opacity: 1 !important }` rule removed from assets/reader.css, served through the harness's stylesheet option | test/browser/appearance-mermaid.test.ts: drawn pairs: gitgraph (commit labels from pixels) | red |
| A7g | the tooltip rule | the `html[data-docreader-hosted] > body > .mermaidTooltip` rule removed from assets/reader.css, served through the harness's stylesheet option | test/browser/appearance-mermaid.test.ts: closed colours: flowchart and flowchart-svg-labels (tooltip background), the definition cues and the tooltip (tooltip computed colours) | red |

```json
[
  {
    "row": "A7c",
    "guard": "the 3px surface halo behind sequence message and loop labels",
    "edit": "the halo rule (`:is(.messageText, .loopText, .loopText > tspan)`) removed from assets/reader.css",
    "tests": "test/browser/appearance-mermaid-draw.test.ts: the first test (halo: computed stroke surface, width 3px)",
    "result": "red"
  },
  {
    "row": "A7d",
    "guard": "the stick half arrowheads in text-muted",
    "edit": "the `marker path[stroke=\"black\"]` rule removed from assets/reader.css",
    "tests": "test/browser/appearance-mermaid-draw.test.ts: both tests (the figure's markers and the full-screen copy's draw rgb(0, 0, 0))",
    "result": "red"
  },
  {
    "row": "A7e",
    "guard": "no drop-shadow filter on a hosted drawing's elements",
    "edit": "the `[filter*=\"drop-shadow\"] { filter: none }` rule removed from assets/reader.css",
    "tests": "test/browser/appearance-mermaid-draw.test.ts: the first test (computed filters of the marked drawings: 4 elements keep a filter)",
    "result": "red"
  },
  {
    "row": "A7f",
    "guard": "cue colours: the verdict's focus, accent and bg on a hosted figure",
    "edit": "the three cue paints written as 1.1.0's literals again in src/enhance/diagram-tools.ts",
    "tests": "test/enhance-appearance-mermaid.test.ts (row A7f), test/browser/appearance-mermaid-draw.test.ts: the first test (ring stroke rgb(11, 107, 102))",
    "result": "red"
  },
  {
    "row": "A7h",
    "guard": "an author-styled figure draws as 1.1.0 draws it",
    "edit": "the author-styled scan skipped in src/enhance/diagrams.ts (`f.cover ??= await covered(...)`)",
    "tests": "test/enhance-appearance-mermaid.test.ts (classification), test/browser/appearance-mermaid-draw.test.ts: the first test (the author-styled flowchart carries the mark)",
    "result": "red"
  },
  {
    "row": "A7i",
    "guard": "a newer appearance cancels the redraws an older one queued",
    "edit": "both generation checks removed from `follow` in src/enhance/diagrams.ts",
    "tests": "test/enhance-appearance-mermaid.test.ts (row A7i: 6 redraws, not 4)",
    "result": "red"
  },
  {
    "row": "A7j",
    "guard": "a kind outside the constant draws as 1.1.0 draws it",
    "edit": "`covered` answers yes for any kind `parse` names (src/enhance/diagrams.ts)",
    "tests": "test/enhance-appearance-mermaid.test.ts (4 rows), test/browser/appearance-mermaid-draw.test.ts: the first test (the journey carries the mark)",
    "result": "red"
  },
  {
    "row": "A7q",
    "guard": "with no colours there is no parse call",
    "edit": "the colours test before classification replaced by `true` (src/enhance/diagrams.ts)",
    "tests": "test/enhance-appearance-mermaid.test.ts (no parse call; colours arriving on a mount)",
    "result": "red"
  },
  {
    "row": "A7r",
    "guard": "the figure tools follow a redrawn svg",
    "edit": "the rebuild of the tools for a new svg disabled in src/enhance/diagram-tools.ts",
    "tests": "test/enhance-appearance-mermaid.test.ts (the tools follow the new drawing: Full screen copies the old svg and its mark)",
    "result": "red"
  },
  {
    "row": "A7s",
    "guard": "the full-screen stage is `surface` for a hosted figure",
    "edit": "the `.fo-stage:has(> svg[data-docreader-hosted-figure])` rule removed from assets/reader.css",
    "tests": "test/browser/appearance-mermaid-draw.test.ts: the full-screen test (stage plate is 1.1.0's rgb(31, 31, 31))",
    "result": "red"
  },
  {
    "row": "A7t",
    "guard": "no filter on a hosted drawing, in the figure and in the overlay",
    "edit": "the `--fig-filter: none` rule removed from assets/reader.css",
    "tests": "test/browser/appearance-mermaid-draw.test.ts: both tests (invert(0.88) hue-rotate(180deg) on the marked svg)",
    "result": "red"
  },
  {
    "row": "A7u",
    "guard": "the drawing is marked `data-docreader-hosted-figure`",
    "edit": "the svg mark never written (src/enhance/diagrams.ts)",
    "tests": "test/enhance-appearance-mermaid.test.ts (6 rows), test/browser/appearance-mermaid-draw.test.ts: both tests",
    "result": "red"
  },
  {
    "row": "A7v",
    "guard": "a change redraws only the figures it affects",
    "edit": "every started figure redrawn on any change (src/enhance/diagrams.ts)",
    "tests": "test/enhance-appearance-mermaid.test.ts (an appearance that removes the colours: 4 renders, not 3)",
    "result": "red"
  },
  {
    "row": "A7k",
    "guard": "the cherry-pick disc is text-muted",
    "edit": "the `circle.commit-cherry-pick:not([fill])` rule removed from assets/reader.css (the disc draws black), served through the harness's stylesheet option",
    "tests": "test/browser/appearance-mermaid.test.ts: the gitGraph marks row (disc not text-muted, marks 1:1 or worse on it) and closed colours: gitgraph (disc paint)",
    "result": "red"
  },
  {
    "row": "A7l",
    "guard": "the disc rule never reaches a mark",
    "edit": "the disc rule widened to every `.commit-cherry-pick` (selector `circle.commit-cherry-pick:not([fill])` replaced by `.commit-cherry-pick`), served through the harness's stylesheet option",
    "tests": "test/browser/appearance-mermaid.test.ts: the gitGraph marks row (dots and stems on a text-muted disc at 1:1) and closed colours: gitgraph (a mark painted text-muted)",
    "result": "red"
  },
  {
    "row": "A7a",
    "guard": "mermaidThemeOf drops one key",
    "edit": "`lineColor` removed from the text-muted row of the derivation table in src/enhance/appearance-mermaid.ts (sha256 checked equal after restore); then, for a key outside `THEME_VARIABLES`, `gridColor` removed from the `rule` row",
    "tests": "test/browser/appearance-mermaid.test.ts: every key assigned (the first: `THEME_VARIABLES key lineColor`; the second: `gantt: keys drawn but not assigned: [gridColor]`)",
    "result": "red"
  },
  {
    "row": "A7b",
    "guard": "the commit-label rule",
    "edit": "the `.commit-label-bkg { opacity: 1 !important }` rule removed from assets/reader.css, served through the harness's stylesheet option",
    "tests": "test/browser/appearance-mermaid.test.ts: drawn pairs: gitgraph (commit labels from pixels)",
    "result": "red"
  },
  {
    "row": "A7g",
    "guard": "the tooltip rule",
    "edit": "the `html[data-docreader-hosted] > body > .mermaidTooltip` rule removed from assets/reader.css, served through the harness's stylesheet option",
    "tests": "test/browser/appearance-mermaid.test.ts: closed colours: flowchart and flowchart-svg-labels (tooltip background), the definition cues and the tooltip (tooltip computed colours)",
    "result": "red"
  }
]
```
