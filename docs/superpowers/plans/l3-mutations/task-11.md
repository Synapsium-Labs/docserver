# L3 Task 11: mutation rows (the first consumer's requests (a) to (c), and `scanRefs` in code units)

Each guard of Task 11, changed once, with the tests that go red: the option `render(md, {highlight: false})` (`src/render/render.ts`), `./highlight` as the code `render()` uses (`src/highlight/index.ts`, `src/render/fence.ts`, every other `src/render` module, the declarations the entry ships, and the frame project's typecheck of `src/highlight`), the xml grammar without sub-languages (`src/render/highlight.ts`), the Mermaid sizes in code units (`src/render/scan.ts`) and the clobbering case in `conformance/hostile.json`. Measured 2026-10-27 (UTC) on branch `l3-t11-consumer-requests` (base `60241f0`, the Task 11 changes not yet committed), on the final code and test files, after the review's fix round (every row was measured again then; the earlier run's figures are superseded).

**Result.** 10 rows, 10 red: the plan's five (L3.R1 to L3.R5) and five more for guards the task added (L3.R1b, the option's type check; L3.R2b, a second way to fork; L3.R2c, a second colouring path elsewhere in `src/render`; L3.R2d, a highlight.js type in the declarations `./highlight` ships; L3.R2w, the frame project's declarations). Every row exits 1 through failing assertions; L3.R5's notes say which of its failures is not an assertion. No row is an equivalent mutant.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository. For each row: the file's original bytes and their sha256 were saved outside the worktree; each `old` was checked to occur exactly once and replaced by `new` (a row with two sites lists both, in order); the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 3334 to 3636 over the runs) and the row ran as `ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <tests>`, its output captured to a log; the file was then restored from the saved bytes and its sha256 checked equal to the saved one (never `git checkout`). Every restore matched, and after the last row `sha256sum -c` over every `src/render` file, `src/highlight/index.ts`, `conformance/hostile.json`, `tsconfig.frame.json` and every `test/*.ts` matched the hashes taken before the first (124 files). No row mutates an input of the frame build, so none needs a rebuild. The Red column gives the count line and the failing tests (at most five). In the Change column a line break is shown as ⏎; the JSON fence holds the exact text.

Notes on the measurement.
- L3.R2d re-types `xmlWithoutSubLanguages` with highlight.js's own type. Only the row that emits `./highlight`'s declarations and typechecks a worker consumer against highlight.js's real types goes red: its listed files gain `lib.dom.d.ts`, `highlight.js/types/index.d.ts` and `highlight.js/lib/core.d.ts`. The frame project's row (L3.R2w) stays green, because its `paths` stubs stand in for highlight.js there; that is why the emitted-declarations row exists.
- L3.R3 is red on the committed case `h-xml-script-style-256k` through two of its verdict's arms: four forbidden classes appear (`language-javascript`, `language-css`, `hljs-subst`, `hljs-selector-tag`) and its output grows to 18.205 times its input against `maxOutputRatio` 2. Its `maxMs` 1000 did not fire: in the recorded run each 256 KiB variant row, two renders each, took about 1 s in all, so no single render came near 1000 ms. The time arm does not discriminate on this machine: measured outside the suite, the stock grammar took 0.35 s to 0.7 s for the same input and the copy without sub-languages 23 ms to 62 ms. The class and ratio arms are what make the row red.
- L3.R3 leaves green the row "the stock grammar sends script to javascript and style to css; the private copy sends nothing anywhere": the mutation registers the stock grammar, while that row reads the copy itself (`xmlWithoutSubLanguages`), which the mutation leaves as it is.
- L3.R3 leaves green the row "a markdown fence's inline tags show no javascript or css class either": highlight.js's markdown grammar hands only a tag, never an element's content, to xml, so that row is a property of the output and is titled as one, not a guard of the copy.
- L3.R5 is red in `test/hostile-input.test.ts` through four assertion failures; the fifth failing test there ("renders to its expected output under its verdict: runCorpus carries it") fails with `loadCorpus`'s own refusal, an `Error`, not an assertion, and is not counted. With `test/corpus.test.ts` in the same run, that file fails to load for the same refusal (a setup error, not counted).

## L3.R1: `render(md, {highlight: false})` (`src/render/render.ts`)

The option reaches the document's highlighter, which has no budget when it is false; a value that is not a boolean is refused.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.R1 | ignore the option: render() does not hand `highlight` to the document's env | `src/render/render.ts` | `    const env = createEnv({ lineAttrs: o?.lineAttrs ?? true, highlight });` → `    const env = createEnv({ lineAttrs: o?.lineAttrs ?? true });` | `test/highlight-api.test.ts`: 2 failed \| 27 passed (29). "equals render() as text over the corpus, keeps every wrapper and class, and writes no span in code"; "a fence keeps its wrapper, data-line and language class; a Mermaid figure is unaffected" | sha256 `1b15f816774c…` restored, equal |
| L3.R1b | accept a `highlight` that is not a boolean | `src/render/render.ts` | ``   if (typeof highlight !== 'boolean') throw new TypeError(`render: highlight must be a boolean, got ${typeof highlight}`); ⏎  `` → (removed) | `test/highlight-api.test.ts`: 1 failed \| 28 passed (29). "highlight must be a boolean" | sha256 `1b15f816774c…` restored, equal |

```json
[
  {
    "id": "L3.R1",
    "guard": "ignore the option: render() does not hand `highlight` to the document's env",
    "file": "src/render/render.ts",
    "old": "    const env = createEnv({ lineAttrs: o?.lineAttrs ?? true, highlight });",
    "new": "    const env = createEnv({ lineAttrs: o?.lineAttrs ?? true });",
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3590,
    "red": "2 failed | 27 passed (29)",
    "failing": [
      "L3.R1: render(md, {highlight: false}) > equals render() as text over the corpus, keeps every wrapper and class, and writes no span in code",
      "L3.R1: render(md, {highlight: false}) > a fence keeps its wrapper, data-line and language class; a Mermaid figure is unaffected"
    ],
    "notAssertion": [],
    "sha256": "1b15f816774c44a8249ed1c2425f5508ce600332ca6d403ac7fb1b2bcd47db7b",
    "restored": true
  },
  {
    "id": "L3.R1b",
    "guard": "accept a `highlight` that is not a boolean",
    "file": "src/render/render.ts",
    "old": "  if (typeof highlight !== 'boolean') throw new TypeError(`render: highlight must be a boolean, got ${typeof highlight}`);\n",
    "new": "",
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3632,
    "red": "1 failed | 28 passed (29)",
    "failing": [
      "L3.R1: render(md, {highlight: false}) > highlight must be a boolean"
    ],
    "notAssertion": [],
    "sha256": "1b15f816774c44a8249ed1c2425f5508ce600332ca6d403ac7fb1b2bcd47db7b",
    "restored": true
  }
]
```

## L3.R2: `./highlight` is the code `render()` uses (`src/highlight/index.ts`, `src/render/fence.ts`, `src/render/tables.ts`, `src/render/highlight.ts`, `tsconfig.frame.json`)

The plan's mutation "fork the implementation" in its two places: the entry exporting a function of its own, and the fence rule deciding on its own. L3.R2c adds a third place, another `src/render` module importing the colouring code. L3.R2d gives the test export of the xml copy highlight.js's own type, which would put highlight.js's declarations, and through them the DOM library, into what `./highlight` ships. L3.R2w removes the frame project's mapping of highlight.js's declarations to the purity stubs: highlight.js's own declarations reference the DOM library, which would then type every file of `src/frame` and `src/highlight`.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.R2a | fork the implementation: `./highlight` exports a createHighlighter of its own | `src/highlight/index.ts` | `export { ⏎   createHighlighter, ⏎   HIGHLIGHT_ENGINE, ⏎ ` → `import { createHighlighter as renderCreateHighlighter } from '../render/highlight.js'; ⏎ /** A fork: the entry's own function. */ ⏎ export function createHighlighter(o?: Parameters<typeof renderCreateHighlighter>[0]): ReturnType<typeof renderCreateHighlighter> { ⏎   return renderCreateHighlighter(o); ⏎ } ⏎ export { ⏎   HIGHLIGHT_ENGINE, ⏎ ` | `test/highlight-api.test.ts`: 2 failed \| 27 passed (29). "the entry only re-exports src/render/highlight.ts, so the render purity walls cover what it ships"; "the same function object, imported by the fence rule and by nothing else in src/render" | sha256 `c3229f006272…` restored, equal |
| L3.R2b | fork the implementation: the fence rule colours with its own copy of the decision | `src/render/fence.ts` | `import { fenceName, MAX_DOCUMENT_CHARS, MAX_LINE_CHARS } from './highlight.js';` → `import { fenceName, highlightCode, MAX_DOCUMENT_CHARS, MAX_LINE_CHARS, resolveLanguage } from './highlight.js'; ⏎ import { escapeHtml } from './escape.js';`; `  const { html, language } = env.highlighter.highlight(codeText(token.content), token.info);` → `  const text = codeText(token.content); ⏎   const language = resolveLanguage(name); ⏎   const used = env.highlighter.highlight('', '').charsUsed; ⏎   const html = language !== null && used + text.length <= MAX_DOCUMENT_CHARS ? highlightCode(text, language) : escapeHtml(text);` | `test/highlight-api.test.ts`: 4 failed \| 25 passed (29). "the same function object, imported by the fence rule and by nothing else in src/render"; "over every corpus fence, its html is render()'s, in order, with one highlighter a document"; "equals render() as text over the corpus, keeps every wrapper and class, and writes no span in code"; "a fence keeps its wrapper, data-line and language class; a Mermaid figure is unaffected" | sha256 `1991a86baaec…` restored, equal |
| L3.R2c | a second colouring path: another src/render module imports highlightCode | `src/render/tables.ts` | `import { pyStrip } from './pyText.js';` → `import { pyStrip } from './pyText.js'; ⏎ import { highlightCode } from './highlight.js';` | `test/highlight-api.test.ts`: 1 failed \| 28 passed (29). "the same function object, imported by the fence rule and by nothing else in src/render" | sha256 `2a32b5321b4f…` restored, equal |
| L3.R2d | type the test export with highlight.js's own type, so `./highlight`'s emitted declarations import highlight.js and the DOM library | `src/render/highlight.ts` | `export const xmlWithoutSubLanguages: (api: never) => object = xmlCopy;` → `export const xmlWithoutSubLanguages: LanguageDefinition = xmlCopy;` | `test/highlight-api.test.ts`: 1 failed \| 28 passed (29). "its emitted declarations, read by a worker consumer with highlight.js's real types, load no DOM declarations" | sha256 `4ac690b15a67…` restored, equal |
| L3.R2w | the frame project reads highlight.js's own declarations, which bring the DOM library in | `tsconfig.frame.json` | `, ⏎     "paths": { ⏎       "highlight.js/lib/core": ["./src/types/purity/highlight-core.d.ts"], ⏎       "highlight.js/lib/languages/*": ["./src/types/purity/highlight-language.d.ts"] ⏎     }` → (removed) | `test/highlight-api.test.ts`: 1 failed \| 28 passed (29). "the frame project, which holds src/highlight, loads no DOM declarations" | sha256 `2772c00b4659…` restored, equal |

```json
[
  {
    "id": "L3.R2a",
    "guard": "fork the implementation: `./highlight` exports a createHighlighter of its own",
    "file": "src/highlight/index.ts",
    "old": "export {\n  createHighlighter,\n  HIGHLIGHT_ENGINE,\n",
    "new": "import { createHighlighter as renderCreateHighlighter } from '../render/highlight.js';\n/** A fork: the entry's own function. */\nexport function createHighlighter(o?: Parameters<typeof renderCreateHighlighter>[0]): ReturnType<typeof renderCreateHighlighter> {\n  return renderCreateHighlighter(o);\n}\nexport {\n  HIGHLIGHT_ENGINE,\n",
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3385,
    "red": "2 failed | 27 passed (29)",
    "failing": [
      "./highlight: its exports (request (a)) > the entry only re-exports src/render/highlight.ts, so the render purity walls cover what it ships",
      "L3.R2: ./highlight is the code render() uses > the same function object, imported by the fence rule and by nothing else in src/render"
    ],
    "notAssertion": [],
    "sha256": "c3229f006272aae2daa8e6b6c47158ae330a335cee9a669850ce093bdd3ef3a6",
    "restored": true
  },
  {
    "id": "L3.R2b",
    "guard": "fork the implementation: the fence rule colours with its own copy of the decision",
    "file": "src/render/fence.ts",
    "old": [
      "import { fenceName, MAX_DOCUMENT_CHARS, MAX_LINE_CHARS } from './highlight.js';",
      "  const { html, language } = env.highlighter.highlight(codeText(token.content), token.info);"
    ],
    "new": [
      "import { fenceName, highlightCode, MAX_DOCUMENT_CHARS, MAX_LINE_CHARS, resolveLanguage } from './highlight.js';\nimport { escapeHtml } from './escape.js';",
      "  const text = codeText(token.content);\n  const language = resolveLanguage(name);\n  const used = env.highlighter.highlight('', '').charsUsed;\n  const html = language !== null && used + text.length <= MAX_DOCUMENT_CHARS ? highlightCode(text, language) : escapeHtml(text);"
    ],
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3533,
    "red": "4 failed | 25 passed (29)",
    "failing": [
      "L3.R2: ./highlight is the code render() uses > the same function object, imported by the fence rule and by nothing else in src/render",
      "L3.R2: ./highlight is the code render() uses > over every corpus fence, its html is render()'s, in order, with one highlighter a document",
      "L3.R1: render(md, {highlight: false}) > equals render() as text over the corpus, keeps every wrapper and class, and writes no span in code",
      "L3.R1: render(md, {highlight: false}) > a fence keeps its wrapper, data-line and language class; a Mermaid figure is unaffected"
    ],
    "notAssertion": [],
    "sha256": "1991a86baaec47dd75ecb84fc2248d353b700cb1084276eb12339900f6cc459a",
    "restored": true
  },
  {
    "id": "L3.R2c",
    "guard": "a second colouring path: another src/render module imports highlightCode",
    "file": "src/render/tables.ts",
    "old": "import { pyStrip } from './pyText.js';",
    "new": "import { pyStrip } from './pyText.js';\nimport { highlightCode } from './highlight.js';",
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3435,
    "red": "1 failed | 28 passed (29)",
    "failing": [
      "L3.R2: ./highlight is the code render() uses > the same function object, imported by the fence rule and by nothing else in src/render"
    ],
    "notAssertion": [],
    "sha256": "2a32b5321b4f053b2ea34375ad72c392659b0e6bef4e431b2b1b13ba01664cc6",
    "restored": true
  },
  {
    "id": "L3.R2d",
    "guard": "type the test export with highlight.js's own type, so `./highlight`'s emitted declarations import highlight.js and the DOM library",
    "file": "src/render/highlight.ts",
    "old": "export const xmlWithoutSubLanguages: (api: never) => object = xmlCopy;",
    "new": "export const xmlWithoutSubLanguages: LanguageDefinition = xmlCopy;",
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3471,
    "red": "1 failed | 28 passed (29)",
    "failing": [
      "./highlight is pure and worker-safe > its emitted declarations, read by a worker consumer with highlight.js's real types, load no DOM declarations"
    ],
    "notAssertion": [],
    "sha256": "4ac690b15a6782137e53b8f3f7031652b167312274006d06d6efb4d631a04c15",
    "restored": true
  },
  {
    "id": "L3.R2w",
    "guard": "the frame project reads highlight.js's own declarations, which bring the DOM library in",
    "file": "tsconfig.frame.json",
    "old": ",\n    \"paths\": {\n      \"highlight.js/lib/core\": [\"./src/types/purity/highlight-core.d.ts\"],\n      \"highlight.js/lib/languages/*\": [\"./src/types/purity/highlight-language.d.ts\"]\n    }",
    "new": "",
    "tests": "test/highlight-api.test.ts",
    "rc": 1,
    "threads": 3636,
    "red": "1 failed | 28 passed (29)",
    "failing": [
      "./highlight is pure and worker-safe > the frame project, which holds src/highlight, loads no DOM declarations"
    ],
    "notAssertion": [],
    "sha256": "2772c00b46590e137697c415c501d089cde5d3b3456903ba2feb553e40ba7561",
    "restored": true
  }
]
```

## L3.R3: xml without sub-languages (`src/render/highlight.ts`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.R3 | restore stock xml sub-languages | `src/render/highlight.ts` | `  ['xml', xmlCopy, ['html', 'svg']],` → `  ['xml', xml, ['html', 'svg']],` | `test/highlight-api.test.ts test/highlight.test.ts test/corpus.test.ts`: 8 failed \| 149 passed (157). "h-xml-script-style-256k: passes"; "a xml fence: its tags are coloured, its script and style text is not handed to another grammar"; "a html fence: its tags are coloured, its script and style text is not handed to another grammar"; "a svg fence: its tags are coloured, its script and style text is not handed to another grammar"; "a HTML fence: its tags are coloured, its script and style text is not handed to another grammar"; and 3 more | sha256 `4ac690b15a67…` restored, equal |

```json
[
  {
    "id": "L3.R3",
    "guard": "restore stock xml sub-languages",
    "file": "src/render/highlight.ts",
    "old": "  ['xml', xmlCopy, ['html', 'svg']],",
    "new": "  ['xml', xml, ['html', 'svg']],",
    "tests": "test/highlight-api.test.ts test/highlight.test.ts test/corpus.test.ts",
    "rc": 1,
    "threads": 3455,
    "red": "8 failed | 149 passed (157)",
    "failing": [
      "the corpus against render() > h-xml-script-style-256k: passes",
      "L3.R3: xml without its embedded sub-languages (request (c)) > a xml fence: its tags are coloured, its script and style text is not handed to another grammar",
      "L3.R3: xml without its embedded sub-languages (request (c)) > a html fence: its tags are coloured, its script and style text is not handed to another grammar",
      "L3.R3: xml without its embedded sub-languages (request (c)) > a svg fence: its tags are coloured, its script and style text is not handed to another grammar",
      "L3.R3: xml without its embedded sub-languages (request (c)) > a HTML fence: its tags are coloured, its script and style text is not handed to another grammar",
      "L3.R3: xml without its embedded sub-languages (request (c)) > h-xml-script-style-256k, fence named xml: its verdict holds with highlighting on and off (timeScale 1)",
      "L3.R3: xml without its embedded sub-languages (request (c)) > h-xml-script-style-256k, fence named html: its verdict holds with highlighting on and off (timeScale 1)",
      "highlightCode > xml keeps the text of a script or a style element out of every other grammar (docserver L3, Task 11, request (c))"
    ],
    "notAssertion": [],
    "sha256": "4ac690b15a6782137e53b8f3f7031652b167312274006d06d6efb4d631a04c15",
    "restored": true
  }
]
```

## L3.R4: `scanRefs().mermaid` in code units (`src/render/scan.ts`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.R4 | count bytes in the Chars fields | `src/render/scan.ts` | `  const chars = t.content.length;` → `  const chars = bytes;` | `test/scan.test.ts`: 5 failed \| 79 passed (84). "Mermaid sources with escapes and non-ASCII text"; "sizes are UTF-8 bytes of the source: the largest one, and the sum"; "largestChars and totalChars count code units: an astral character is two, a three-byte one is one"; "where bytes and units disagree on the largest fence, each field names its own"; "a three-byte character is one unit and three bytes" | sha256 `2e51a2afb2a0…` restored, equal |

```json
[
  {
    "id": "L3.R4",
    "guard": "count bytes in the Chars fields",
    "file": "src/render/scan.ts",
    "old": "  const chars = t.content.length;",
    "new": "  const chars = bytes;",
    "tests": "test/scan.test.ts",
    "rc": 1,
    "threads": 3334,
    "red": "5 failed | 79 passed (84)",
    "failing": [
      "scanRefs and meta agree with the html render() emits > Mermaid sources with escapes and non-ASCII text",
      "scanRefs: Mermaid fences > sizes are UTF-8 bytes of the source: the largest one, and the sum",
      "L3.R4: Mermaid sizes in UTF-16 code units, the unit of the layout's maxTextSize gate (FD12) > largestChars and totalChars count code units: an astral character is two, a three-byte one is one",
      "L3.R4: Mermaid sizes in UTF-16 code units, the unit of the layout's maxTextSize gate (FD12) > where bytes and units disagree on the largest fence, each field names its own",
      "L3.R4: Mermaid sizes in UTF-16 code units, the unit of the layout's maxTextSize gate (FD12) > a three-byte character is one unit and three bytes"
    ],
    "notAssertion": [],
    "sha256": "2e51a2afb2a0c813cc036dd30f437e59e63ab1b4656ac003bbf4ee35829aa047",
    "restored": true
  }
]
```

## L3.R5: `h-dom-clobber-frame-names` (`conformance/hostile.json`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.R5 | drop the case from `hostile.json` | `conformance/hostile.json` | `  { ⏎     "id": "h-dom-clobber-frame-names", ⏎     "verdict": {"outcome": "rendered", "maxMs": 1000, "require": ["<h1 id=\"seed\"", "<h1 id=\"bootstrap\"", "<h1 id=\"guard\"", "<h1 id=\"docserver\"", "<h1 id=\"docreader\"", "<h1 id=\"currentscript\"", "<h1 id=\"enhance\"", "<h1 id=\"mermaid\"", "<span class=\"doc-anchor\" id=\"seed\"></span>", "<span class=\"doc-anchor\" id=\"bootstrap\"></span>", "<span class=\"doc-anchor\" id=\"guard\"></span>", "<span class=\"doc-anchor\" id=\"docserver\"></span>", "<span class=\"doc-anchor\" id=\"docreader\"></span>", "<span class=\"doc-anchor\" id=\"currentScript\"></span>", "<span class=\"doc-anchor\" id=\"enhance\"></span>", "<span class=\"doc-anchor\" id=\"mermaid\"></span>"], "exact": true} ⏎   }, ⏎ ` → (removed) | `test/hostile-input.test.ts`: 5 failed \| 40 passed (45). "agrees with the manifest: 17 hostile and 30 generated cases"; "lists its entries in manifest order"; "is a hostile case of the manifest, listed in hostile.json with an exact golden"; "its verdict requires each id as render() emits it: the heading slug, and the anchor exactly"; "renders to its expected output under its verdict: runCorpus carries it" | sha256 `db3a8bcb57ed…` restored, equal |

```json
[
  {
    "id": "L3.R5",
    "guard": "drop the case from `hostile.json`",
    "file": "conformance/hostile.json",
    "old": "  {\n    \"id\": \"h-dom-clobber-frame-names\",\n    \"verdict\": {\"outcome\": \"rendered\", \"maxMs\": 1000, \"require\": [\"<h1 id=\\\"seed\\\"\", \"<h1 id=\\\"bootstrap\\\"\", \"<h1 id=\\\"guard\\\"\", \"<h1 id=\\\"docserver\\\"\", \"<h1 id=\\\"docreader\\\"\", \"<h1 id=\\\"currentscript\\\"\", \"<h1 id=\\\"enhance\\\"\", \"<h1 id=\\\"mermaid\\\"\", \"<span class=\\\"doc-anchor\\\" id=\\\"seed\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"bootstrap\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"guard\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"docserver\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"docreader\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"currentScript\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"enhance\\\"></span>\", \"<span class=\\\"doc-anchor\\\" id=\\\"mermaid\\\"></span>\"], \"exact\": true}\n  },\n",
    "new": "",
    "tests": "test/hostile-input.test.ts",
    "rc": 1,
    "threads": 3519,
    "red": "5 failed | 40 passed (45)",
    "failing": [
      "the shipped hostile.json > agrees with the manifest: 17 hostile and 30 generated cases",
      "the shipped hostile.json > lists its entries in manifest order",
      "L3.R5: h-dom-clobber-frame-names (the spec's DOM clobbering case, for the reader frame) > is a hostile case of the manifest, listed in hostile.json with an exact golden",
      "L3.R5: h-dom-clobber-frame-names (the spec's DOM clobbering case, for the reader frame) > its verdict requires each id as render() emits it: the heading slug, and the anchor exactly",
      "L3.R5: h-dom-clobber-frame-names (the spec's DOM clobbering case, for the reader frame) > renders to its expected output under its verdict: runCorpus carries it"
    ],
    "notAssertion": [
      "L3.R5: h-dom-clobber-frame-names (the spec's DOM clobbering case, for the reader frame) > renders to its expected output under its verdict: runCorpus carries it"
    ],
    "sha256": "db3a8bcb57ed5ae8525e95efa0852653c7cfa3aa51cde8c5d50177362f3d2652",
    "restored": true
  }
]
```
