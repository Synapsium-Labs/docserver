# L2 Task 21: mutation rows (diagrams: drawing)

Each guard of Task 21, deleted or changed once, with the tests that go red: the drawing in the second phase and its
configuration (`src/enhance/diagrams.ts`), and the figure rules (`assets/reader.css`). 95 rows, L2-T21-M1 to
L2-T21-M95: 84 red (`rc=1`) and 11 green, each green row reported below with why (C49, C52). Three control runs,
L2-T21-C1 to L2-T21-C3, all green.

**Where they were measured.** The jsdom rows, L2-T21-M1 to L2-T21-M79, and the control L2-T21-C1, at commit
`69cce0e` on branch `l2-t21-diagrams`. The browser rows, L2-T21-M80 to L2-T21-M95, and the controls L2-T21-C2 and
L2-T21-C3, at commit `1efc48a`, whose files under test are the same: the only later change before `69cce0e` is
`test/enhance-diagrams.test.ts`, which the browser rows do not run. Each batch left the checkout as it found it:
`git status --porcelain` and the hash of `git diff` the same before and after (`HEAD` moved only by this task's own
commits between batches).

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), as Task 15 ran it, one row at a time. Each row is applied to
its own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked
from the checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs
exactly once in its file. The rows ran with `DOCREADER_BROWSERS=chromium`: the browser rows ran in Chromium, and WebKit
was reported as excluded (the `11 skipped` in their counts). No row is WebKit-only; the browser cases, unmutated, are
green in WebKit too (the Playwright image, C51). The Red column gives the count line and the failing tests the run
printed (at most five).

Notes on the measurement.
- **Rows on the built file, and their control runs.** The browser tests build the Mermaid file themselves, in memory,
  with `scripts/build-mermaid.mjs` (CI runs the tests before `npm run build`), so a row whose tests read the built file
  runs plain `vitest`, not `npm run build:mermaid && vitest`: the copy has no `assets/mermaid/` (it is ignored), and the
  test builds the file from the copy's own script. Those rows are L2-T21-M80 to L2-T21-M95. Each test command was run
  once in an unmutated copy the same way, as a control (the last section).
- **The secure groups** red the jsdom file through the schema cases, which read the pinned package's configuration
  types (`mermaid/dist/config.type.d.ts`) with TypeScript's parser: every style-bearing key must be listed, and nothing
  else but Mermaid's own six. The theme and font groups red a real drawing too (L2-T21-M89 and L2-T21-M90).
- **L2-T21-M70 to L2-T21-M79 are green**, as C52 rules for a check LD5 asks for: each live() check after an await, the
  two operations, and the passes' stops are backed by what refuses or never calls back once the instance is not live
  (the journal, the host's wrapper, env's fonts, frame and timeout), so no case can tell one alone. They stay.
- **L2-T21-M88 is green in the browser** and red in jsdom (L2-T21-M9): measured while writing the cases, Mermaid
  12.1.0 keeps its own six secure keys when initialize() is given a list, and reads maxEdges and the security level
  from the site configuration whatever a directive says. The library still lists them, so the protection does not
  depend on that.
- **Three rows were green on their first measurement**, and their cases were made to tell the guard apart (commits
  `9b66595`, `69cce0e` and `1efc48a`): L2-T21-M29 (the near bound) and L2-T21-M31 (the distance above the window),
  whose layout let the mutant draw in the same order; and L2-T21-M88's browser case, whose directive now also asks for
  a lower text size (it stays green, as above).
- **Two guards went before measurement (C49):** the chrome check when the source `pre` is found (nothing is drawn in
  beside it yet), and the placeholder rule's figure-class qualifiers (the hide rule wins once a figure is drawn or
  failed); and, before the rows, the live() check before the second phase's first write and the host's `present`
  check (the journal and the host's wrapper refuse then; `options.mermaid` is set exactly when a load is).

## The configuration: `src/enhance/diagrams.ts` (L2-T21-M1 to L2-T21-M24)

What initialize() is given before every run: the security level, start-on-load, error rendering, the layout, the limits and the host's, each group of secure keys and the host's additions, a new object per call, the theme and its font, and the label sanitising. The secure groups red on the schema cases, which read the pinned package's configuration types.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T21-M1 | securityLevel strict | `src/enhance/diagrams.ts` | `    securityLevel: 'strict',` → `    securityLevel: 'loose',` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M2 | startOnLoad false | `src/enhance/diagrams.ts` | `    startOnLoad: false,` → `    startOnLoad: true,` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M3 | suppressErrorRendering true | `src/enhance/diagrams.ts` | `    suppressErrorRendering: true,` → `    suppressErrorRendering: false,` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M4 | layout dagre (C53) | `src/enhance/diagrams.ts` | `    layout: 'dagre', ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M5 | maxTextSize pinned at Mermaid 12.1.0's default | `src/enhance/diagrams.ts` | `export const MAX_TEXT_SIZE = 50_000;` → `export const MAX_TEXT_SIZE = 50_001;` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "pins the limits at Mermaid 12.1.0's defaults, and its own secure keys first" |
| L2-T21-M6 | maxEdges pinned at Mermaid 12.1.0's default | `src/enhance/diagrams.ts` | `export const MAX_EDGES = 500;` → `export const MAX_EDGES = 501;` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "pins the limits at Mermaid 12.1.0's defaults, and its own secure keys first" |
| L2-T21-M7 | the host's maxTextSize replaces the default | `src/enhance/diagrams.ts` | `    maxTextSize: settings.maxTextSize ?? MAX_TEXT_SIZE,` → `    maxTextSize: MAX_TEXT_SIZE,` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "the host's limits replace the pinned defaults" |
| L2-T21-M8 | the host's maxEdges replaces the default | `src/enhance/diagrams.ts` | `    maxEdges: settings.maxEdges ?? MAX_EDGES,` → `    maxEdges: MAX_EDGES,` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "the host's limits replace the pinned defaults" |
| L2-T21-M9 | secure group: Mermaid's own six | `src/enhance/diagrams.ts` | `    mermaid: [...MERMAID_SECURE],` → `    mermaid: [],` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "pins the limits at Mermaid 12.1.0's defaults, and its own secure keys first"; "lists nothing else but Mermaid's own secure keys" |
| L2-T21-M10 | secure group: theme | `src/enhance/diagrams.ts` | `    theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],` → `    theme: [],` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "lists every style-bearing key of the schema" |
| L2-T21-M11 | secure group: styles | `src/enhance/diagrams.ts` | `    styles: ['labelStyle', 'numberSectionStyles'],` → `    styles: [],` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "lists every style-bearing key of the schema" |
| L2-T21-M12 | secure group: fonts | `src/enhance/diagrams.ts` | `    fonts: [ ⏎       'fontFamily', 'altFontFamily', 'fontSize', 'fontSizeFactor', 'fontWeight', ⏎       'actorFont', 'actorFontFamily', '…` → `    fonts: [], ⏎ ` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "lists every style-bearing key of the schema" |
| L2-T21-M13 | secure group: colours | `src/enhance/diagrams.ts` | `    colours: [ ⏎       'fill', 'stroke', 'strokeWidth', 'lineColor', 'linkColor', 'titleColor', 'text_color', 'colorScheme', 'disableMult…` → `    colours: [], ⏎ ` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "lists every style-bearing key of the schema" |
| L2-T21-M14 | secure group: C4 shapes | `src/enhance/diagrams.ts` | `    c4: [ ⏎       ...c4.flatMap((s) => [`${s}Font`, `${s}FontFamily`, `${s}FontSize`, `${s}FontWeight`]), ⏎       ...c4.flatMap((s) => [`…` → `    c4: [], ⏎ ` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "lists every style-bearing key of the schema"; "keeps the groups apart: each key in one group, the groups in the list's order" |
| L2-T21-M15 | the host's secure keys are added | `src/enhance/diagrams.ts` | `  for (const k of settings.secure) if (!secure.includes(k)) secure.push(k); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 6 failed \| 26 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "serialises the calls per Mermaid module across roots: one root's run ends before the next initialize"; "two Mermaid modules have a queue each: a call on one never waits for the other"; "a source longer than maxTextSize is never handed to Mermaid: its note says it is too long"; "a destroy during a pass stops it: the call in flight ends, no other is made, nothing is written"; and 1 more |
| L2-T21-M16 | the host's secure keys are added once each | `src/enhance/diagrams.ts` | `if (!secure.includes(k)) secure.push(k);` → `secure.push(k);` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M17 | a new configuration object for each call | `src/enhance/diagrams.ts` | `  return () => ({ ⏎     startOnLoad: false, ⏎     securityLevel: 'strict', ⏎     suppressErrorRendering: true, ⏎     layout: 'dagre', ⏎  …` → `  const made = { ⏎     startOnLoad: false, ⏎     securityLevel: 'strict', ⏎     suppressErrorRendering: true, ⏎     layout: 'dagre', ⏎   …` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M18 | the theme is base | `src/enhance/diagrams.ts` | `    theme: 'base',` → `    theme: 'default',` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M19 | the theme variables carry the font family | `src/enhance/diagrams.ts` | `    themeVariables: { ...THEME_VARIABLES, fontFamily },` → `    themeVariables: { ...THEME_VARIABLES },` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "takes the font family from the root's --sans when it is a plain list of families, and its own otherwise" |
| L2-T21-M20 | the font family is a plain list of families, else the fallback | `src/enhance/diagrams.ts` | `  return FAMILIES.test(v) ? v : FONT_FALLBACK;` → `  return v !== '' ? v : FONT_FALLBACK;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "takes the font family from the root's --sans when it is a plain list of families, and its own otherwise" |
| L2-T21-M21 | labels are sanitised with the reader's dompurifyConfig | `src/enhance/diagrams.ts` | `    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] }, ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M22 | a label loses its class attributes | `src/enhance/diagrams.ts` | `const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;` → `const LABEL_ATTRS_REFUSED = ['style'] as const;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M23 | a label loses its style attributes | `src/enhance/diagrams.ts` | `const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;` → `const LABEL_ATTRS_REFUSED = ['class'] as const;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |
| L2-T21-M24 | a label loses its style elements | `src/enhance/diagrams.ts` | `const LABEL_TAGS_REFUSED = ['style'] as const;` → `const LABEL_TAGS_REFUSED = [] as const;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |

```json
[
  {
    "id": "L2-T21-M1",
    "guard": "securityLevel strict",
    "file": "src/enhance/diagrams.ts",
    "old": "    securityLevel: 'strict',",
    "new": "    securityLevel: 'loose',",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M2",
    "guard": "startOnLoad false",
    "file": "src/enhance/diagrams.ts",
    "old": "    startOnLoad: false,",
    "new": "    startOnLoad: true,",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M3",
    "guard": "suppressErrorRendering true",
    "file": "src/enhance/diagrams.ts",
    "old": "    suppressErrorRendering: true,",
    "new": "    suppressErrorRendering: false,",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M4",
    "guard": "layout dagre (C53)",
    "file": "src/enhance/diagrams.ts",
    "old": "    layout: 'dagre',\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M5",
    "guard": "maxTextSize pinned at Mermaid 12.1.0's default",
    "file": "src/enhance/diagrams.ts",
    "old": "export const MAX_TEXT_SIZE = 50_000;",
    "new": "export const MAX_TEXT_SIZE = 50_001;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M6",
    "guard": "maxEdges pinned at Mermaid 12.1.0's default",
    "file": "src/enhance/diagrams.ts",
    "old": "export const MAX_EDGES = 500;",
    "new": "export const MAX_EDGES = 501;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M7",
    "guard": "the host's maxTextSize replaces the default",
    "file": "src/enhance/diagrams.ts",
    "old": "    maxTextSize: settings.maxTextSize ?? MAX_TEXT_SIZE,",
    "new": "    maxTextSize: MAX_TEXT_SIZE,",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M8",
    "guard": "the host's maxEdges replaces the default",
    "file": "src/enhance/diagrams.ts",
    "old": "    maxEdges: settings.maxEdges ?? MAX_EDGES,",
    "new": "    maxEdges: MAX_EDGES,",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M9",
    "guard": "secure group: Mermaid's own six",
    "file": "src/enhance/diagrams.ts",
    "old": "    mermaid: [...MERMAID_SECURE],",
    "new": "    mermaid: [],",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M10",
    "guard": "secure group: theme",
    "file": "src/enhance/diagrams.ts",
    "old": "    theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],",
    "new": "    theme: [],",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M11",
    "guard": "secure group: styles",
    "file": "src/enhance/diagrams.ts",
    "old": "    styles: ['labelStyle', 'numberSectionStyles'],",
    "new": "    styles: [],",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M12",
    "guard": "secure group: fonts",
    "file": "src/enhance/diagrams.ts",
    "old": "    fonts: [\n      'fontFamily', 'altFontFamily', 'fontSize', 'fontSizeFactor', 'fontWeight',\n      'actorFont', 'actorFontFamily', 'actorFontSize', 'actorFontWeight',\n      'boundaryFont', 'boundaryFontFamily', 'boundaryFontSize', 'boundaryFontWeight',\n      'messageFont', 'messageFontFamily', 'messageFontSize', 'messageFontWeight',\n      'noteFont', 'noteFontFamily', 'noteFontSize', 'noteFontWeight',\n      'usecaseFontFamily', 'usecaseFontSize', 'usecaseFontWeight',\n      'taskFontFamily', 'taskFontSize', 'titleFontFamily', 'titleFontSize',\n      'axisFontSize', 'labelFontSize', 'legendFontSize', 'pointLabelFontSize', 'quadrantLabelFontSize', 'sectionFontSize',\n      'xAxisLabelFontSize', 'yAxisLabelFontSize',\n    ],\n",
    "new": "    fonts: [],\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M13",
    "guard": "secure group: colours",
    "file": "src/enhance/diagrams.ts",
    "old": "    colours: [\n      'fill', 'stroke', 'strokeWidth', 'lineColor', 'linkColor', 'titleColor', 'text_color', 'colorScheme', 'disableMulticolor',\n      'actorColours', 'sectionColours', 'sectionFills', 'nodeColors', 'markerFill', 'rect_fill', 'rect_border_color', 'ruleNameColor',\n      'commentFill', 'commentStroke', 'commentTextColor', 'nonTerminalFill', 'nonTerminalStroke', 'nonTerminalTextColor',\n      'terminalFill', 'terminalStroke', 'terminalTextColor', 'specialFill', 'specialStroke',\n      'quadrantExternalBorderStrokeWidth', 'quadrantInternalBorderStrokeWidth',\n    ],\n",
    "new": "    colours: [],\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M14",
    "guard": "secure group: C4 shapes",
    "file": "src/enhance/diagrams.ts",
    "old": "    c4: [\n      ...c4.flatMap((s) => [`${s}Font`, `${s}FontFamily`, `${s}FontSize`, `${s}FontWeight`]),\n      ...c4.flatMap((s) => [`${s}_bg_color`, `${s}_border_color`]),\n    ],\n",
    "new": "    c4: [],\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M15",
    "guard": "the host's secure keys are added",
    "file": "src/enhance/diagrams.ts",
    "old": "  for (const k of settings.secure) if (!secure.includes(k)) secure.push(k);\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M16",
    "guard": "the host's secure keys are added once each",
    "file": "src/enhance/diagrams.ts",
    "old": "if (!secure.includes(k)) secure.push(k);",
    "new": "secure.push(k);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M17",
    "guard": "a new configuration object for each call",
    "file": "src/enhance/diagrams.ts",
    "old": "  return () => ({\n    startOnLoad: false,\n    securityLevel: 'strict',\n    suppressErrorRendering: true,\n    layout: 'dagre',\n    maxTextSize: settings.maxTextSize ?? MAX_TEXT_SIZE,\n    maxEdges: settings.maxEdges ?? MAX_EDGES,\n    secure: [...secure],\n    theme: 'base',\n    fontFamily,\n    themeVariables: { ...THEME_VARIABLES, fontFamily },\n    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] },\n  });\n}\n",
    "new": "  const made = {\n    startOnLoad: false,\n    securityLevel: 'strict',\n    suppressErrorRendering: true,\n    layout: 'dagre',\n    maxTextSize: settings.maxTextSize ?? MAX_TEXT_SIZE,\n    maxEdges: settings.maxEdges ?? MAX_EDGES,\n    secure: [...secure],\n    theme: 'base',\n    fontFamily,\n    themeVariables: { ...THEME_VARIABLES, fontFamily },\n    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] },\n  };\n  return () => made;\n}\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M18",
    "guard": "the theme is base",
    "file": "src/enhance/diagrams.ts",
    "old": "    theme: 'base',",
    "new": "    theme: 'default',",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M19",
    "guard": "the theme variables carry the font family",
    "file": "src/enhance/diagrams.ts",
    "old": "    themeVariables: { ...THEME_VARIABLES, fontFamily },",
    "new": "    themeVariables: { ...THEME_VARIABLES },",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M20",
    "guard": "the font family is a plain list of families, else the fallback",
    "file": "src/enhance/diagrams.ts",
    "old": "  return FAMILIES.test(v) ? v : FONT_FALLBACK;",
    "new": "  return v !== '' ? v : FONT_FALLBACK;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M21",
    "guard": "labels are sanitised with the reader's dompurifyConfig",
    "file": "src/enhance/diagrams.ts",
    "old": "    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] },\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M22",
    "guard": "a label loses its class attributes",
    "file": "src/enhance/diagrams.ts",
    "old": "const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;",
    "new": "const LABEL_ATTRS_REFUSED = ['style'] as const;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M23",
    "guard": "a label loses its style attributes",
    "file": "src/enhance/diagrams.ts",
    "old": "const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;",
    "new": "const LABEL_ATTRS_REFUSED = ['class'] as const;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M24",
    "guard": "a label loses its style elements",
    "file": "src/enhance/diagrams.ts",
    "old": "const LABEL_TAGS_REFUSED = ['style'] as const;",
    "new": "const LABEL_TAGS_REFUSED = [] as const;",
    "tests": "test/enhance-diagrams.test.ts"
  }
]
```

## The queue, the order and the scheduling (L2-T21-M25 to L2-T21-M34)

One call at a time per Mermaid module across roots, initialize before each run, the near figures first and the rest by distance, a frame before the first drawing and a task between the passes.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T21-M25 | the queue: every call goes through the module's queue | `src/enhance/diagrams.ts` | `  const drawing = await enqueue(api, () => call(ctx, api, config, f));` → `  const drawing = await call(ctx, api, config, f);` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "serialises the calls per Mermaid module across roots: one root's run ends before the next initialize"; "a destroyed root's queued call is never made, and the queue moves on to the next root" |
| L2-T21-M26 | the queue: one per Mermaid module | `src/enhance/diagrams.ts` | `  const next = (queues.get(api) ?? Promise.resolve()).then(task); ⏎   queues.set( ⏎     api,` → `  const next = (queues.get(queues) ?? Promise.resolve()).then(task); ⏎   queues.set( ⏎     queues,` | `test/enhance-diagrams.test.ts`: 11 failed \| 21 passed (32). "two Mermaid modules have a queue each: a call on one never waits for the other"; "takes the figure's width from the drawing's viewBox when Mermaid gave it no max-width, and none past 100000 px"; "a source of exactly maxTextSize characters is drawn"; "the feature's second phase, run for an instance that is no longer live, asks for nothing and writes nothing"; "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details"; and 3 more |
| L2-T21-M27 | initialize before each run | `src/enhance/diagrams.ts` | `      api.initialize(config()); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 9 failed \| 23 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "the host's limits replace the pinned defaults"; "takes the font family from the root's --sans when it is a plain list of families, and its own otherwise"; "serialises the calls per Mermaid module across roots: one root's run ends before the next initialize"; "two Mermaid modules have a queue each: a call on one never waits for the other"; and 1 more |
| L2-T21-M28 | near figures first | `src/enhance/diagrams.ts` | `  const near = figs.filter((f) => distance(f.source, h) < h * NEAR);` → `  const near = figs.filter(() => true);` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "lets the page run a task between the near figures and the rest"; "draws the figures near the viewport first, in document order, then the rest, nearest first" |
| L2-T21-M29 | near is less than 1.5 screens away | `src/enhance/diagrams.ts` | `const NEAR = 1.5;` → `const NEAR = 1;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws the figures near the viewport first, in document order, then the rest, nearest first" |
| L2-T21-M30 | the rest nearest first | `src/enhance/diagrams.ts` | `    .sort((a, b) => a.d - b.d \|\| a.i - b.i);` → `    .sort((a, b) => a.i - b.i);` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws the figures near the viewport first, in document order, then the rest, nearest first" |
| L2-T21-M31 | the distance of a figure above the viewport | `src/enhance/diagrams.ts` | `r.bottom < 0 ? -r.bottom :` → `r.bottom < 0 ? 0 :` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws the figures near the viewport first, in document order, then the rest, nearest first" |
| L2-T21-M32 | the distance of a figure below the viewport | `src/enhance/diagrams.ts` | `r.top > h ? r.top - h : 0` → `r.top > h ? 0 : 0` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "lets the page run a task between the near figures and the rest"; "draws the figures near the viewport first, in document order, then the rest, nearest first" |
| L2-T21-M33 | a frame before the first drawing | `src/enhance/diagrams.ts` | `  await new Promise<void>((resolve) => { ⏎     ctx.env.frame(resolve); ⏎   }); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws nothing before the next frame, so the page is painted first" |
| L2-T21-M34 | a task between the two passes | `src/enhance/diagrams.ts` | `  await new Promise<void>((resolve) => { ⏎     ctx.env.timeout(resolve, 0); ⏎   }); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "lets the page run a task between the near figures and the rest" |

```json
[
  {
    "id": "L2-T21-M25",
    "guard": "the queue: every call goes through the module's queue",
    "file": "src/enhance/diagrams.ts",
    "old": "  const drawing = await enqueue(api, () => call(ctx, api, config, f));",
    "new": "  const drawing = await call(ctx, api, config, f);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M26",
    "guard": "the queue: one per Mermaid module",
    "file": "src/enhance/diagrams.ts",
    "old": "  const next = (queues.get(api) ?? Promise.resolve()).then(task);\n  queues.set(\n    api,",
    "new": "  const next = (queues.get(queues) ?? Promise.resolve()).then(task);\n  queues.set(\n    queues,",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M27",
    "guard": "initialize before each run",
    "file": "src/enhance/diagrams.ts",
    "old": "      api.initialize(config());\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M28",
    "guard": "near figures first",
    "file": "src/enhance/diagrams.ts",
    "old": "  const near = figs.filter((f) => distance(f.source, h) < h * NEAR);",
    "new": "  const near = figs.filter(() => true);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M29",
    "guard": "near is less than 1.5 screens away",
    "file": "src/enhance/diagrams.ts",
    "old": "const NEAR = 1.5;",
    "new": "const NEAR = 1;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M30",
    "guard": "the rest nearest first",
    "file": "src/enhance/diagrams.ts",
    "old": "    .sort((a, b) => a.d - b.d || a.i - b.i);",
    "new": "    .sort((a, b) => a.i - b.i);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M31",
    "guard": "the distance of a figure above the viewport",
    "file": "src/enhance/diagrams.ts",
    "old": "r.bottom < 0 ? -r.bottom :",
    "new": "r.bottom < 0 ? 0 :",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M32",
    "guard": "the distance of a figure below the viewport",
    "file": "src/enhance/diagrams.ts",
    "old": "r.top > h ? r.top - h : 0",
    "new": "r.top > h ? 0 : 0",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M33",
    "guard": "a frame before the first drawing",
    "file": "src/enhance/diagrams.ts",
    "old": "  await new Promise<void>((resolve) => {\n    ctx.env.frame(resolve);\n  });\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M34",
    "guard": "a task between the two passes",
    "file": "src/enhance/diagrams.ts",
    "old": "  await new Promise<void>((resolve) => {\n    ctx.env.timeout(resolve, 0);\n  });\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  }
]
```

## What is drawn, and what falls back (L2-T21-M35 to L2-T21-M67)

The size check, what counts as drawn, the module's shape, the gate and the state, a drawn figure's class, role, name and width, a failed figure's class and note, and the chrome drawing beside the source.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T21-M35 | a source over maxTextSize is never handed to Mermaid | `src/enhance/diagrams.ts` | `  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {` → `  if (false) {` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a source longer than maxTextSize is never handed to Mermaid: its note says it is too long" |
| L2-T21-M36 | a source of exactly maxTextSize is drawn | `src/enhance/diagrams.ts` | `  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {` → `  if (f.text.length >= (settings.maxTextSize ?? MAX_TEXT_SIZE)) {` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a source of exactly maxTextSize characters is drawn" |
| L2-T21-M37 | the size check reads the host's maxTextSize | `src/enhance/diagrams.ts` | `  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {` → `  if (f.text.length > MAX_TEXT_SIZE) {` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a source longer than maxTextSize is never handed to Mermaid: its note says it is too long" |
| L2-T21-M38 | Mermaid's error drawing counts as failed | `src/enhance/diagrams.ts` | `return n.getAttribute('aria-roledescription') === 'error' ? null : (n as SVGSVGElement);` → `return n as SVGSVGElement;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a drawing Mermaid made of its own error counts as failed" |
| L2-T21-M39 | a drawing that left its figure counts as failed | `src/enhance/diagrams.ts` | `  const svg = drawing.parentNode === f.entry.figure ? drawnSvg(drawing) : null;` → `  const svg = drawnSvg(drawing);` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a drawing that left its figure (the host moved it) counts as failed" |
| L2-T21-M40 | the module's default export is Mermaid's API | `src/enhance/diagrams.ts` | `      if (isApi(d)) return d; ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 21 failed \| 11 passed (32).  |
| L2-T21-M41 | the module itself may be Mermaid's API | `src/enhance/diagrams.ts` | `    return isApi(mod) ? mod : null;` → `    return null;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a module that is the API itself draws as well as one whose default export is the API" |
| L2-T21-M42 | Mermaid's API has initialize and run | `src/enhance/diagrams.ts` | `  return typeof m.initialize === 'function' && typeof m.run === 'function';` → `  return typeof m.run === 'function';` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a module that does not load, or is not Mermaid's, leaves every figure to its fallback with the load note" |
| L2-T21-M43 | a host getter that throws reads as no module | `src/enhance/diagrams.ts` | `    return null; // a getter of the host's that throws` → `    throw new Error('rethrown');` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a module that does not load, or is not Mermaid's, leaves every figure to its fallback with the load note" |
| L2-T21-M44 | no figure, no load | `src/enhance/diagrams.ts` | `  if (figs.length === 0) return; ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a document without figures asks for nothing: the host's load is never called" |
| L2-T21-M45 | no mermaid option, no drawing | `src/enhance/diagrams.ts` | `  if (settings === null) return; // no mermaid option, so no load to call (normalizeOptions keeps the two together) ⏎ ` → `  if (settings === null) { void 0; } ⏎ ` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws nothing without the mermaid option: no gate, no state, each figure keeps its source" |
| L2-T21-M46 | the gate is set when drawing starts | `src/enhance/diagrams.ts` | `  ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); // the gate (C43) ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "asks the host for the module once, as drawing starts, with the gate and the state set before anything is drawn"; "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing" |
| L2-T21-M47 | the state reads drawing while it draws | `src/enhance/diagrams.ts` | `  ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); // the state (LD5) ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "asks the host for the module once, as drawing starts, with the gate and the state set before anything is drawn"; "RF5: a load() that resolves after a destroy draws nothing" |
| L2-T21-M48 | the state reads failed when every figure failed | `src/enhance/diagrams.ts` | `failed === figs.length ? 'failed' : 'partial'` → `'partial'` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "a drawing Mermaid made of its own error counts as failed"; "a module that does not load, or is not Mermaid's, leaves every figure to its fallback with the load note" |
| L2-T21-M49 | the state reads drawn when none failed | `src/enhance/diagrams.ts` | `failed === 0 ? 'drawn' :` → `failed === -1 ? 'drawn' :` | `test/enhance-diagrams.test.ts`: 16 failed \| 16 passed (32). "asks the host for the module once, as drawing starts, with the gate and the state set before anything is drawn"; "a module that is the API itself draws as well as one whose default export is the API"; "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "the host's limits replace the pinned defaults" |
| L2-T21-M50 | a drawn figure takes the class drawn | `src/enhance/diagrams.ts` | `  journal.toggleClass(f.entry.figure, 'drawn', true); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 5 failed \| 27 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing"; "marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content"; "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details"; "a drawing that left its figure (the host moved it) counts as failed"; "a module whose initialize or run throws leaves that figure to its fallback, and the others draw" |
| L2-T21-M51 | the drawing is an image | `src/enhance/diagrams.ts` | `  journal.setAttribute(svg, 'role', 'img'); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing" |
| L2-T21-M52 | the drawing is named | `src/enhance/diagrams.ts` | `  journal.setAttribute(svg, 'aria-label', labelOf(ctx, f, svg)); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing"; "names a drawing by its caption, else by its own title, else by the first line of its source" |
| L2-T21-M53 | the name is the caption first | `src/enhance/diagrams.ts` | `f.entry.caption !== '' ? f.entry.caption : ` → (deleted) | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing"; "names a drawing by its caption, else by its own title, else by the first line of its source" |
| L2-T21-M54 | then the drawing's own title | `src/enhance/diagrams.ts` | `title !== '' ? title : ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "names a drawing by its caption, else by its own title, else by the first line of its source" |
| L2-T21-M55 | then the source's first line, past comments | `src/enhance/diagrams.ts` | ` && !l.startsWith('%%')` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "names a drawing by its caption, else by its own title, else by the first line of its source" |
| L2-T21-M56 | the figure is as wide as its drawing | `src/enhance/diagrams.ts` | `  if (w !== null) journal.setStyle(f.entry.figure, '--fig-w', `${String(Math.ceil(w + PLATE))}px`); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing"; "takes the figure's width from the drawing's viewBox when Mermaid gave it no max-width, and none past 100000 px" |
| L2-T21-M57 | the width counts the plate | `src/enhance/diagrams.ts` | `Math.ceil(w + PLATE)` → `Math.ceil(w)` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing"; "takes the figure's width from the drawing's viewBox when Mermaid gave it no max-width, and none past 100000 px" |
| L2-T21-M58 | the width falls back to the viewBox | `src/enhance/diagrams.ts` | `      w = svg.viewBox.baseVal.width;` → `      w = Number.NaN;` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "takes the figure's width from the drawing's viewBox when Mermaid gave it no max-width, and none past 100000 px" |
| L2-T21-M59 | the width is bounded | `src/enhance/diagrams.ts` | ` && w <= WIDTH_MAX` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "takes the figure's width from the drawing's viewBox when Mermaid gave it no max-width, and none past 100000 px" |
| L2-T21-M60 | a failed figure takes the class draw-failed | `src/enhance/diagrams.ts` | `  ctx.journal.toggleClass(f.entry.figure, 'draw-failed', true); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 5 failed \| 27 passed (32). "marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content"; "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details"; "a drawing Mermaid made of its own error counts as failed"; "a source longer than maxTextSize is never handed to Mermaid: its note says it is too long"; "a module that does not load, or is not Mermaid's, leaves every figure to its fallback with the load note" |
| L2-T21-M61 | the note goes before the source | `src/enhance/diagrams.ts` | `  ctx.journal.insert(note, f.entry.figure, f.source);` → `  ctx.journal.insert(note, f.entry.figure, null);` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details" |
| L2-T21-M62 | the note holds the source | `src/enhance/diagrams.ts` | `[chrome(doc, 'code', { text: f.text })]` → `[chrome(doc, 'code', { text: '' })]` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details" |
| L2-T21-M63 | the note's source takes the focus | `src/enhance/diagrams.ts` | `attrs: { tabindex: '0' }` → `attrs: {}` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details" |
| L2-T21-M64 | the note says why | `src/enhance/diagrams.ts` | `chrome(doc, 'p', { text: NOTES[why] })` → `chrome(doc, 'p', { text: NOTES.error })` | `test/enhance-diagrams.test.ts`: 2 failed \| 30 passed (32). "a source longer than maxTextSize is never handed to Mermaid: its note says it is too long"; "a module that does not load, or is not Mermaid's, leaves every figure to its fallback with the load note" |
| L2-T21-M65 | the drawing goes in right after the source | `src/enhance/diagrams.ts` | `      ctx.journal.insert(drawing, f.entry.figure, f.source.nextSibling);` → `      ctx.journal.insert(drawing, f.entry.figure, f.source);` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing" |
| L2-T21-M66 | the drawing holds the source's text | `src/enhance/diagrams.ts` | `chrome(ctx.root.ownerDocument, 'pre', { className: 'mermaid', text: f.text })` → `chrome(ctx.root.ownerDocument, 'pre', { className: 'mermaid', text: '' })` | `test/enhance-diagrams.test.ts`: 12 failed \| 20 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's"; "marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content"; "a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details"; "lets the page run a task between the near figures and the rest"; "names a drawing by its caption, else by its own title, else by the first line of its source" |
| L2-T21-M67 | run is asked to keep its errors | `src/enhance/diagrams.ts` | `api.run({ nodes: [drawing], suppressErrors: true })` → `api.run({ nodes: [drawing], suppressErrors: false })` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "initialises before each run, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's" |

```json
[
  {
    "id": "L2-T21-M35",
    "guard": "a source over maxTextSize is never handed to Mermaid",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {",
    "new": "  if (false) {",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M36",
    "guard": "a source of exactly maxTextSize is drawn",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {",
    "new": "  if (f.text.length >= (settings.maxTextSize ?? MAX_TEXT_SIZE)) {",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M37",
    "guard": "the size check reads the host's maxTextSize",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {",
    "new": "  if (f.text.length > MAX_TEXT_SIZE) {",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M38",
    "guard": "Mermaid's error drawing counts as failed",
    "file": "src/enhance/diagrams.ts",
    "old": "return n.getAttribute('aria-roledescription') === 'error' ? null : (n as SVGSVGElement);",
    "new": "return n as SVGSVGElement;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M39",
    "guard": "a drawing that left its figure counts as failed",
    "file": "src/enhance/diagrams.ts",
    "old": "  const svg = drawing.parentNode === f.entry.figure ? drawnSvg(drawing) : null;",
    "new": "  const svg = drawnSvg(drawing);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M40",
    "guard": "the module's default export is Mermaid's API",
    "file": "src/enhance/diagrams.ts",
    "old": "      if (isApi(d)) return d;\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M41",
    "guard": "the module itself may be Mermaid's API",
    "file": "src/enhance/diagrams.ts",
    "old": "    return isApi(mod) ? mod : null;",
    "new": "    return null;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M42",
    "guard": "Mermaid's API has initialize and run",
    "file": "src/enhance/diagrams.ts",
    "old": "  return typeof m.initialize === 'function' && typeof m.run === 'function';",
    "new": "  return typeof m.run === 'function';",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M43",
    "guard": "a host getter that throws reads as no module",
    "file": "src/enhance/diagrams.ts",
    "old": "    return null; // a getter of the host's that throws",
    "new": "    throw new Error('rethrown');",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M44",
    "guard": "no figure, no load",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (figs.length === 0) return;\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M45",
    "guard": "no mermaid option, no drawing",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (settings === null) return; // no mermaid option, so no load to call (normalizeOptions keeps the two together)\n",
    "new": "  if (settings === null) { void 0; }\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M46",
    "guard": "the gate is set when drawing starts",
    "file": "src/enhance/diagrams.ts",
    "old": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); // the gate (C43)\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M47",
    "guard": "the state reads drawing while it draws",
    "file": "src/enhance/diagrams.ts",
    "old": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); // the state (LD5)\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M48",
    "guard": "the state reads failed when every figure failed",
    "file": "src/enhance/diagrams.ts",
    "old": "failed === figs.length ? 'failed' : 'partial'",
    "new": "'partial'",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M49",
    "guard": "the state reads drawn when none failed",
    "file": "src/enhance/diagrams.ts",
    "old": "failed === 0 ? 'drawn' :",
    "new": "failed === -1 ? 'drawn' :",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M50",
    "guard": "a drawn figure takes the class drawn",
    "file": "src/enhance/diagrams.ts",
    "old": "  journal.toggleClass(f.entry.figure, 'drawn', true);\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M51",
    "guard": "the drawing is an image",
    "file": "src/enhance/diagrams.ts",
    "old": "  journal.setAttribute(svg, 'role', 'img');\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M52",
    "guard": "the drawing is named",
    "file": "src/enhance/diagrams.ts",
    "old": "  journal.setAttribute(svg, 'aria-label', labelOf(ctx, f, svg));\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M53",
    "guard": "the name is the caption first",
    "file": "src/enhance/diagrams.ts",
    "old": "f.entry.caption !== '' ? f.entry.caption : ",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M54",
    "guard": "then the drawing's own title",
    "file": "src/enhance/diagrams.ts",
    "old": "title !== '' ? title : ",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M55",
    "guard": "then the source's first line, past comments",
    "file": "src/enhance/diagrams.ts",
    "old": " && !l.startsWith('%%')",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M56",
    "guard": "the figure is as wide as its drawing",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (w !== null) journal.setStyle(f.entry.figure, '--fig-w', `${String(Math.ceil(w + PLATE))}px`);\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M57",
    "guard": "the width counts the plate",
    "file": "src/enhance/diagrams.ts",
    "old": "Math.ceil(w + PLATE)",
    "new": "Math.ceil(w)",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M58",
    "guard": "the width falls back to the viewBox",
    "file": "src/enhance/diagrams.ts",
    "old": "      w = svg.viewBox.baseVal.width;",
    "new": "      w = Number.NaN;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M59",
    "guard": "the width is bounded",
    "file": "src/enhance/diagrams.ts",
    "old": " && w <= WIDTH_MAX",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M60",
    "guard": "a failed figure takes the class draw-failed",
    "file": "src/enhance/diagrams.ts",
    "old": "  ctx.journal.toggleClass(f.entry.figure, 'draw-failed', true);\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M61",
    "guard": "the note goes before the source",
    "file": "src/enhance/diagrams.ts",
    "old": "  ctx.journal.insert(note, f.entry.figure, f.source);",
    "new": "  ctx.journal.insert(note, f.entry.figure, null);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M62",
    "guard": "the note holds the source",
    "file": "src/enhance/diagrams.ts",
    "old": "[chrome(doc, 'code', { text: f.text })]",
    "new": "[chrome(doc, 'code', { text: '' })]",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M63",
    "guard": "the note's source takes the focus",
    "file": "src/enhance/diagrams.ts",
    "old": "attrs: { tabindex: '0' }",
    "new": "attrs: {}",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M64",
    "guard": "the note says why",
    "file": "src/enhance/diagrams.ts",
    "old": "chrome(doc, 'p', { text: NOTES[why] })",
    "new": "chrome(doc, 'p', { text: NOTES.error })",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M65",
    "guard": "the drawing goes in right after the source",
    "file": "src/enhance/diagrams.ts",
    "old": "      ctx.journal.insert(drawing, f.entry.figure, f.source.nextSibling);",
    "new": "      ctx.journal.insert(drawing, f.entry.figure, f.source);",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M66",
    "guard": "the drawing holds the source's text",
    "file": "src/enhance/diagrams.ts",
    "old": "chrome(ctx.root.ownerDocument, 'pre', { className: 'mermaid', text: f.text })",
    "new": "chrome(ctx.root.ownerDocument, 'pre', { className: 'mermaid', text: '' })",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M67",
    "guard": "run is asked to keep its errors",
    "file": "src/enhance/diagrams.ts",
    "old": "api.run({ nodes: [drawing], suppressErrors: true })",
    "new": "api.run({ nodes: [drawing], suppressErrors: false })",
    "tests": "test/enhance-diagrams.test.ts"
  }
]
```

## Position, relayout, operations and live checks (L2-T21-M68 to L2-T21-M79)

Each mark inside position.keep with a relayout for its content (both red), then the operations and the live() checks of the second phase. Those ten are green: each is backed by the journal, the host's wrapper or env, which refuse or never call back once the instance is not live. They stay (LD5 asks for a check after each await, and features.ts for writes inside operations) and are reported here, as C52 rules.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T21-M68 | each figure's mark is made inside position.keep | `src/enhance/diagrams.ts` | `    ctx.position.keep(() => { ⏎       if (svg === null) markFailed(ctx, f, why); ⏎       else markDrawn(ctx, f, svg); ⏎     }); ⏎     ctx…` → `    ((): void => { ⏎       if (svg === null) markFailed(ctx, f, why); ⏎       else markDrawn(ctx, f, svg); ⏎     })(); ⏎     ctx.relayout…` | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content" |
| L2-T21-M69 | a relayout for the content | `src/enhance/diagrams.ts` | `    ctx.relayout('content'); ⏎ ` → (deleted) | `test/enhance-diagrams.test.ts`: 1 failed \| 31 passed (32). "marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content" |
| L2-T21-M70 | Mermaid is called inside an operation | `src/enhance/diagrams.ts` | `    running = ctx.operate(() => { ⏎       ctx.journal.insert(drawing, f.entry.figure, f.source.nextSibling); ⏎       api.initialize(confi…` → `    running = ((): { run: unknown } => { ⏎       ctx.journal.insert(drawing, f.entry.figure, f.source.nextSibling); ⏎       api.initializ…` | green, reported (C52): Mermaid is reached only once live() has been checked, at the start of the queued call, so after a destroy the call returns before it; the operation also defers a destroy asked for while Mermaid runs, which no case makes. |
| L2-T21-M71 | a figure's mark is written inside an operation | `src/enhance/diagrams.ts` | `  ctx.operate(() => { ⏎     ctx.position.keep(() => { ⏎       if (svg === null) markFailed(ctx, f, why); ⏎       else markDrawn(ctx, f, s…` → `  ((): void => { ⏎     ctx.position.keep(() => { ⏎       if (svg === null) markFailed(ctx, f, why); ⏎       else markDrawn(ctx, f, svg); …` | green, reported (C52): a mark is written only after live() was checked on the call's return, and the journal refuses every write once the instance is not live. |
| L2-T21-M72 | live() before a queued call | `src/enhance/diagrams.ts` | `  if (!ctx.live()) return null; ⏎   const drawing = chrome(` → `  const drawing = chrome(` | green, reported (C52, LD5): the check that skips a destroyed instance's queued call; without it the call's operation refuses at once, so Mermaid is still never called. |
| L2-T21-M73 | live() after the fonts wait | `src/enhance/diagrams.ts` | `  await ctx.env.fonts(FONT_WAIT_MS); ⏎   if (!ctx.live()) return; ⏎ ` → `  await ctx.env.fonts(FONT_WAIT_MS); ⏎ ` | green, reported (C52, LD5): env.fonts never settles once the instance is not live. |
| L2-T21-M74 | live() after the load | `src/enhance/diagrams.ts` | `  const api = mermaidOf(await loading); ⏎   if (!ctx.live()) return; ⏎ ` → `  const api = mermaidOf(await loading); ⏎ ` | green, reported (C52, LD5): the host's wrapper answers null once the instance is not live, and every write after it is refused. |
| L2-T21-M75 | live() after the frame | `src/enhance/diagrams.ts` | `  if (!ctx.live()) return; ⏎   const h = ctx.env.viewport().h;` → `  const h = ctx.env.viewport().h;` | green, reported (C52, LD5): env.frame never calls back once the instance is not live. |
| L2-T21-M76 | live() after the task between the passes | `src/enhance/diagrams.ts` | `  if (!ctx.live()) return; ⏎   const h2 = ctx.env.viewport().h;` → `  const h2 = ctx.env.viewport().h;` | green, reported (C52, LD5): env.timeout never calls back once the instance is not live. |
| L2-T21-M77 | live() after each queued call | `src/enhance/diagrams.ts` | `  if (!ctx.live() \|\| drawing === null) return null;` → `  if (drawing === null) return null;` | green, reported (C52, LD5): after a destroy the next call returns null at its own check, and every write is refused. |
| L2-T21-M78 | a stopped call ends the near pass | `src/enhance/diagrams.ts` | `    if (drawn === null) return; ⏎     if (!drawn) failed += 1; ⏎   } ⏎   await new Promise` → `    if (!drawn) failed += 1; ⏎   } ⏎   await new Promise` | green, reported (C52): the pass goes on through the remaining figures, each call returning null at its own check; nothing is called or written. |
| L2-T21-M79 | a stopped call ends the rest | `src/enhance/diagrams.ts` | `    if (drawn === null) return; ⏎     if (!drawn) failed += 1; ⏎   } ⏎   settle();` → `    if (!drawn) failed += 1; ⏎   } ⏎   settle();` | green, reported (C52): as M78, for the rest. |

```json
[
  {
    "id": "L2-T21-M68",
    "guard": "each figure's mark is made inside position.keep",
    "file": "src/enhance/diagrams.ts",
    "old": "    ctx.position.keep(() => {\n      if (svg === null) markFailed(ctx, f, why);\n      else markDrawn(ctx, f, svg);\n    });\n    ctx.relayout('content');\n",
    "new": "    ((): void => {\n      if (svg === null) markFailed(ctx, f, why);\n      else markDrawn(ctx, f, svg);\n    })();\n    ctx.relayout('content');\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M69",
    "guard": "a relayout for the content",
    "file": "src/enhance/diagrams.ts",
    "old": "    ctx.relayout('content');\n",
    "new": "",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M70",
    "guard": "Mermaid is called inside an operation",
    "file": "src/enhance/diagrams.ts",
    "old": "    running = ctx.operate(() => {\n      ctx.journal.insert(drawing, f.entry.figure, f.source.nextSibling);\n      api.initialize(config());\n      return { run: api.run({ nodes: [drawing], suppressErrors: true }) };\n    });\n  } catch {\n",
    "new": "    running = ((): { run: unknown } => {\n      ctx.journal.insert(drawing, f.entry.figure, f.source.nextSibling);\n      api.initialize(config());\n      return { run: api.run({ nodes: [drawing], suppressErrors: true }) };\n    })();\n  } catch {\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M71",
    "guard": "a figure's mark is written inside an operation",
    "file": "src/enhance/diagrams.ts",
    "old": "  ctx.operate(() => {\n    ctx.position.keep(() => {\n      if (svg === null) markFailed(ctx, f, why);\n      else markDrawn(ctx, f, svg);\n    });\n    ctx.relayout('content');\n  });\n",
    "new": "  ((): void => {\n    ctx.position.keep(() => {\n      if (svg === null) markFailed(ctx, f, why);\n      else markDrawn(ctx, f, svg);\n    });\n    ctx.relayout('content');\n  })();\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M72",
    "guard": "live() before a queued call",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (!ctx.live()) return null;\n  const drawing = chrome(",
    "new": "  const drawing = chrome(",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M73",
    "guard": "live() after the fonts wait",
    "file": "src/enhance/diagrams.ts",
    "old": "  await ctx.env.fonts(FONT_WAIT_MS);\n  if (!ctx.live()) return;\n",
    "new": "  await ctx.env.fonts(FONT_WAIT_MS);\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M74",
    "guard": "live() after the load",
    "file": "src/enhance/diagrams.ts",
    "old": "  const api = mermaidOf(await loading);\n  if (!ctx.live()) return;\n",
    "new": "  const api = mermaidOf(await loading);\n",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M75",
    "guard": "live() after the frame",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (!ctx.live()) return;\n  const h = ctx.env.viewport().h;",
    "new": "  const h = ctx.env.viewport().h;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M76",
    "guard": "live() after the task between the passes",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (!ctx.live()) return;\n  const h2 = ctx.env.viewport().h;",
    "new": "  const h2 = ctx.env.viewport().h;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M77",
    "guard": "live() after each queued call",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (!ctx.live() || drawing === null) return null;",
    "new": "  if (drawing === null) return null;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M78",
    "guard": "a stopped call ends the near pass",
    "file": "src/enhance/diagrams.ts",
    "old": "    if (drawn === null) return;\n    if (!drawn) failed += 1;\n  }\n  await new Promise",
    "new": "    if (!drawn) failed += 1;\n  }\n  await new Promise",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-M79",
    "guard": "a stopped call ends the rest",
    "file": "src/enhance/diagrams.ts",
    "old": "    if (drawn === null) return;\n    if (!drawn) failed += 1;\n  }\n  settle();",
    "new": "    if (!drawn) failed += 1;\n  }\n  settle();",
    "tests": "test/enhance-diagrams.test.ts"
  }
]
```

## The figure rules in a real browser: `assets/reader.css` (L2-T21-M80 to L2-T21-M86)

Each rule deleted or loosened once, measured by `test/browser/diagrams.test.ts` in Chromium on the built Mermaid file: the placeholder and its gate, the source hidden once its figure is drawn or failed and the drawing spared, the drawing unseen while Mermaid draws and gone when its figure failed.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T21-M80 | the source is the transparent placeholder under the gate | `assets/reader.css` | `[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure > pre.mermaid:not([data-docreader-chrome]…` → (deleted) | `test/browser/diagrams.test.ts`: 2 failed \| 9 passed \| 11 skipped (22). "while Mermaid loads, the source is the transparent placeholder on its plate, and nothing is drawn yet"; "while Mermaid draws, the drawing is laid out but unseen, and the source is still the placeholder" |
| L2-T21-M81 | the placeholder only under the gate | `assets/reader.css` | `[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure > pre.mermaid:not([data-docreader-chrome]) {` → `[data-docreader-root][data-docreader-root]:not(i) figure.mermaid-figure > pre.mermaid:not([data-docreader-chrome]) {` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "without Mermaid, a figure's source is text on its plate: no gate, no state" |
| L2-T21-M82 | a drawn figure hides its source | `assets/reader.css` | `[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-c…` → (deleted) | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "draws a flowchart and a sequence diagram: the drawing on the plate, named, the figure as wide as it, no source plate" |
| L2-T21-M83 | a failed figure hides its source | `assets/reader.css` | `, ⏎ [data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure.draw-failed > pre.mermaid:not([data-d…` → ` { display: none !important; }` | `test/browser/diagrams.test.ts`: 3 failed \| 8 passed \| 11 skipped (22). "a source over maxTextSize is never handed to Mermaid: the fallback says it is too long"; "edges over maxEdges fail, a directive cannot raise the limit, and the fallback shows"; "a diagram that asks for ELK fails, the file leaving it out, and the fallback shows" |
| L2-T21-M84 | the hide rule spares the drawing | `assets/reader.css` | `figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]),` → `figure.mermaid-figure.drawn > pre.mermaid,` | `test/browser/diagrams.test.ts`: 3 failed \| 8 passed \| 11 skipped (22). "draws a flowchart and a sequence diagram: the drawing on the plate, named, the figure as wide as it, no source plate"; "a directive that binds clicks binds nothing: no handler, a click runs nothing, no link runs script"; "an HTML label keeps its text and loses its handler, its script, its style element, its style and its class" |
| L2-T21-M85 | the drawing is unseen while Mermaid draws | `assets/reader.css` | `[data-docreader-root] figure.mermaid-figure:not(.drawn) > pre.mermaid[data-docreader-chrome] { position: absolute; top: 0; left: 0; right…` → (deleted) | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "while Mermaid draws, the drawing is laid out but unseen, and the source is still the placeholder" |
| L2-T21-M86 | the drawing is gone when its figure failed | `assets/reader.css` | `[data-docreader-root] figure.mermaid-figure.draw-failed > pre.mermaid[data-docreader-chrome] { display: none !important; } ⏎ ` → (deleted) | `test/browser/diagrams.test.ts`: 2 failed \| 9 passed \| 11 skipped (22). "edges over maxEdges fail, a directive cannot raise the limit, and the fallback shows"; "a diagram that asks for ELK fails, the file leaving it out, and the fallback shows" |

```json
[
  {
    "id": "L2-T21-M80",
    "guard": "the source is the transparent placeholder under the gate",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure > pre.mermaid:not([data-docreader-chrome]) { color: transparent !important; min-height: 180px; user-select: none; }\n",
    "new": "",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M81",
    "guard": "the placeholder only under the gate",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure > pre.mermaid:not([data-docreader-chrome]) {",
    "new": "[data-docreader-root][data-docreader-root]:not(i) figure.mermaid-figure > pre.mermaid:not([data-docreader-chrome]) {",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M82",
    "guard": "a drawn figure hides its source",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]),\n",
    "new": "",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M83",
    "guard": "a failed figure hides its source",
    "file": "assets/reader.css",
    "old": ",\n[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure.draw-failed > pre.mermaid:not([data-docreader-chrome]) { display: none !important; }",
    "new": " { display: none !important; }",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M84",
    "guard": "the hide rule spares the drawing",
    "file": "assets/reader.css",
    "old": "figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]),",
    "new": "figure.mermaid-figure.drawn > pre.mermaid,",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M85",
    "guard": "the drawing is unseen while Mermaid draws",
    "file": "assets/reader.css",
    "old": "[data-docreader-root] figure.mermaid-figure:not(.drawn) > pre.mermaid[data-docreader-chrome] { position: absolute; top: 0; left: 0; right: 0; visibility: hidden; pointer-events: none; }\n",
    "new": "",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M86",
    "guard": "the drawing is gone when its figure failed",
    "file": "assets/reader.css",
    "old": "[data-docreader-root] figure.mermaid-figure.draw-failed > pre.mermaid[data-docreader-chrome] { display: none !important; }\n",
    "new": "",
    "tests": "test/browser/diagrams.test.ts"
  }
]
```

## The configuration on the built file, in a real browser (L2-T21-M87 to L2-T21-M95)

Rows of the configuration measured again where the jsdom file cannot see their effect: the drawing itself, under the reader policy, in Chromium.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T21-M87 | securityLevel strict (in the browser) | `src/enhance/diagrams.ts` | `    securityLevel: 'strict',` → `    securityLevel: 'loose',` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "a directive that binds clicks binds nothing: no handler, a click runs nothing, no link runs script" |
| L2-T21-M88 | secure group: Mermaid's own six (in the browser) | `src/enhance/diagrams.ts` | `    mermaid: [...MERMAID_SECURE],` → `    mermaid: [],` | green, reported: Mermaid 12.1.0 keeps its own six secure keys when initialize() is given a list, and reads maxEdges and the security level from the site configuration whatever a directive says, so the browser cases hold without the library's copy. The jsdom file reds on it (L2-T21-M9). |
| L2-T21-M89 | secure group: theme (in the browser) | `src/enhance/diagrams.ts` | `    theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],` → `    theme: [],` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "a directive that restyles is ignored: no fixed element, none of its CSS, font or colours, the reader's theme" |
| L2-T21-M90 | secure group: fonts (in the browser) | `src/enhance/diagrams.ts` | `    fonts: [ ⏎       'fontFamily', 'altFontFamily', 'fontSize', 'fontSizeFactor', 'fontWeight', ⏎       'actorFont', 'actorFontFamily', '…` → `    fonts: [], ⏎ ` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "a directive that restyles is ignored: no fixed element, none of its CSS, font or colours, the reader's theme" |
| L2-T21-M91 | layout dagre (in the browser) | `src/enhance/diagrams.ts` | `    layout: 'dagre', ⏎ ` → (deleted) | `test/browser/diagrams.test.ts`: 4 failed \| 7 passed \| 11 skipped (22). "draws a flowchart and a sequence diagram: the drawing on the plate, named, the figure as wide as it, no source plate"; "a directive that restyles is ignored: no fixed element, none of its CSS, font or colours, the reader's theme"; "a directive that binds clicks binds nothing: no handler, a click runs nothing, no link runs script"; "an HTML label keeps its text and loses its handler, its script, its style element, its style and its class" |
| L2-T21-M92 | the warm theme's primary colour (in the browser) | `src/enhance/diagrams.ts` | `  primaryColor: '#f3f0e9',` → `  primaryColor: '#f3f0ea',` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "a directive that restyles is ignored: no fixed element, none of its CSS, font or colours, the reader's theme" |
| L2-T21-M93 | labels are sanitised with the reader's dompurifyConfig (in the browser) | `src/enhance/diagrams.ts` | `    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] }, ⏎ ` → (deleted) | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "an HTML label keeps its text and loses its handler, its script, its style element, its style and its class" |
| L2-T21-M94 | a label loses its class attributes (in the browser) | `src/enhance/diagrams.ts` | `const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;` → `const LABEL_ATTRS_REFUSED = ['style'] as const;` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "an HTML label keeps its text and loses its handler, its script, its style element, its style and its class" |
| L2-T21-M95 | maxEdges pinned at Mermaid 12.1.0's default (in the browser) | `src/enhance/diagrams.ts` | `export const MAX_EDGES = 500;` → `export const MAX_EDGES = 501;` | `test/browser/diagrams.test.ts`: 1 failed \| 10 passed \| 11 skipped (22). "pins the limits and Mermaid's own secure keys at what 12.1.0 declares, read from the file; its default layout is ELK" |

```json
[
  {
    "id": "L2-T21-M87",
    "guard": "securityLevel strict (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "    securityLevel: 'strict',",
    "new": "    securityLevel: 'loose',",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M88",
    "guard": "secure group: Mermaid's own six (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "    mermaid: [...MERMAID_SECURE],",
    "new": "    mermaid: [],",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M89",
    "guard": "secure group: theme (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "    theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],",
    "new": "    theme: [],",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M90",
    "guard": "secure group: fonts (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "    fonts: [\n      'fontFamily', 'altFontFamily', 'fontSize', 'fontSizeFactor', 'fontWeight',\n      'actorFont', 'actorFontFamily', 'actorFontSize', 'actorFontWeight',\n      'boundaryFont', 'boundaryFontFamily', 'boundaryFontSize', 'boundaryFontWeight',\n      'messageFont', 'messageFontFamily', 'messageFontSize', 'messageFontWeight',\n      'noteFont', 'noteFontFamily', 'noteFontSize', 'noteFontWeight',\n      'usecaseFontFamily', 'usecaseFontSize', 'usecaseFontWeight',\n      'taskFontFamily', 'taskFontSize', 'titleFontFamily', 'titleFontSize',\n      'axisFontSize', 'labelFontSize', 'legendFontSize', 'pointLabelFontSize', 'quadrantLabelFontSize', 'sectionFontSize',\n      'xAxisLabelFontSize', 'yAxisLabelFontSize',\n    ],\n",
    "new": "    fonts: [],\n",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M91",
    "guard": "layout dagre (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "    layout: 'dagre',\n",
    "new": "",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M92",
    "guard": "the warm theme's primary colour (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "  primaryColor: '#f3f0e9',",
    "new": "  primaryColor: '#f3f0ea',",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M93",
    "guard": "labels are sanitised with the reader's dompurifyConfig (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] },\n",
    "new": "",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M94",
    "guard": "a label loses its class attributes (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;",
    "new": "const LABEL_ATTRS_REFUSED = ['style'] as const;",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-M95",
    "guard": "maxEdges pinned at Mermaid 12.1.0's default (in the browser)",
    "file": "src/enhance/diagrams.ts",
    "old": "export const MAX_EDGES = 500;",
    "new": "export const MAX_EDGES = 501;",
    "tests": "test/browser/diagrams.test.ts"
  }
]
```

## Control runs (L2-T21-C1 to L2-T21-C3)

Each test command of the rows, run once in an unmutated copy the same way (a row whose `new` equals its `old`, which `mutate.mjs` reports `NOT RED`, as a control should be). The browser commands build the Mermaid file in memory from the copy's own script, as the rows did.

| Row | Command | Result |
|---|---|---|
| L2-T21-C1 | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/enhance-diagrams.test.ts` | NOT RED, 32 passed (32) |
| L2-T21-C2 | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/diagrams.test.ts` | NOT RED, 11 passed \| 11 skipped (22) |
| L2-T21-C3 | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/layout-corpus.test.ts` | NOT RED, 31 passed \| 26 skipped (57) |

```json
[
  {
    "id": "L2-T21-C1",
    "guard": "control: the jsdom file, unmutated",
    "file": "src/enhance/diagrams.ts",
    "old": "export const MAX_EDGES = 500;",
    "new": "export const MAX_EDGES = 500;",
    "tests": "test/enhance-diagrams.test.ts"
  },
  {
    "id": "L2-T21-C2",
    "guard": "control: the browser file on the built Mermaid file, unmutated",
    "file": "src/enhance/diagrams.ts",
    "old": "export const MAX_EDGES = 500;",
    "new": "export const MAX_EDGES = 500;",
    "tests": "test/browser/diagrams.test.ts"
  },
  {
    "id": "L2-T21-C3",
    "guard": "control: the Level 2 cases on the built Mermaid file, unmutated",
    "file": "src/enhance/diagrams.ts",
    "old": "export const MAX_EDGES = 500;",
    "new": "export const MAX_EDGES = 500;",
    "tests": "test/browser/layout-corpus.test.ts"
  }
]
```
## Visual check

The task names one: a flowchart, a sequence diagram and a failed diagram, light and dark (the plate filter).
`scripts/visual/compare.mjs` compared a demo page for `scripts/demo/samples/diagrams.md` with a temporary copy of the
reference reader serving the same sample from a throwaway git repository, both on the loopback interface. The demo page
was `scripts/demo/build.mjs`'s, with Mermaid given (the host's load imports the package's Mermaid file) and ready once
its diagrams are drawn; the reference's Mermaid import was answered from the installed Mermaid 12.1.0 files, and its
page was ready once it said so, so both were measured drawn. Nothing left the machine. Measured at commit `69cce0e`.

| Combination | Blocks in both pages | Differences | Unexpected |
|---|---|---|---|
| 1440×1000, light | 12 | 29 | 0 |
| 1440×1000, dark | 12 | 29 | 0 |
| 390×844, light | 12 | 5 | 0 |
| 390×844, dark | 12 | 5 | 0 |

The expected differences, each named in the compare run's expected list:
- **Hidden, not removed (C43):** the meta line stays in our page, hidden, where the reference drops it.
- **Contents rail not built (Task 18):** on desktop the reference sets its column beside the rail, so the column's auto
  margins resolve differently; every box is equal.
- **The drawing differs (C53):** the reference lays the flowchart out with ELK, and this file with dagre: its figure is
  10 px narrower on desktop (865 against 875) and 0.94 px taller on a phone, where the drawing is scaled to the column,
  and the block after it moves with it. The sequence diagram, which no layout engine draws, matches.

compare.mjs measures each figure as one block, so a probe measured, on both pages, each figure's parts: the plate (the
drawing's `pre`: its box in the figure and 19 computed values: display, background, borders, radius, padding, margins,
font, colour, alignment, overflow), the drawing's svg (its box on the plate, display, filter, cursor), the caption (its
box in the figure, the gap below the plate, 7 computed values), and the failed figure's note (its box and 14 computed
values, its paragraph and summary with their boxes, values and text, the gap to the caption, and that no `pre` of the
figure is shown). In the four combinations, at 0.1 px: the sequence diagram (46 values) and the failed diagram (55
values) are identical, light and dark, the plate filter included; the flowchart differs only in the drawing's size
(the figure's, the plate's and the svg's width on desktop; their height and the caption's offset on a phone), the
difference named above. Every computed value of its plate and caption is the reference's.

The drawing differences, named rather than chased (C53): ELK routes the flowchart's edges at right angles and dagre
draws them as curves, and ELK packs the nodes 10 px tighter. The tools on each figure (Copy Mermaid, Play, Animate
edges, Full screen) are Task 23's, and the bar is Task 12's: the reference shows them; ours does not yet.
