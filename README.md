# docserver

One shared renderer for spec and plan documents written in Markdown. It turns Markdown into the rich reading layout: a contents sidebar, "In short" and "Where things stand" boxes, status labels, figure cards for Mermaid diagrams, quick jump, a glossary on hover, an Index of defined IDs, "Changes since", read marks, and light and dark themes.

It is pure. It does no network, storage, auth, git or hosting. Each product that uses it brings its own transport, login, content source and hosting, and pins one exact version.

**Status:** pre-release and private until v1, which goes public under the MIT licence as `@synapsium-labs/docserver`.

## What it holds

| Part | Entry point | Status |
|---|---|---|
| Markdown rules (markdown-it, TypeScript): GitHub-style Markdown, alerts, figure captions, front matter, heading ids, a short raw-HTML allowlist | `@synapsium-labs/docserver/render`: `render()`, `scanRefs()` | Built |
| The conformance corpus: Markdown in, expected HTML out, plus hostile cases | `@synapsium-labs/docserver/conformance`: `runCorpus()`, `loadCorpus()` | Built |
| The rich layout over a rendered document: its lifecycle, reader prefs, per-document state, the title block, facts panel, "In short" and "Where things stand" boxes, section numbers, status marks in tables, and section folds so far | `@synapsium-labs/docserver/enhance`: `enhance()`, `destroyEnhancement()`, `setEnhancementPrefs()`, `EnhanceError` | Prototype |
| The layout's stylesheet and its fonts | `@synapsium-labs/docserver/assets/*`: `assets/reader.css`, `assets/fonts/` | Prototype |
| A self-hosted Mermaid, and an asset manifest with hashes | `assets/` | Planned |
| A sandboxed-frame document builder, and a host helper | `frameDocument()`, `mountDocFrame()` | Planned |

The package exports exactly `./render`, `./conformance`, `./enhance`, `./assets/*` and `./package.json`; nothing else is importable.

## Rendering: `./render`

```ts
import { render, scanRefs } from '@synapsium-labs/docserver/render';

const r = render(markdown, { maxBytes: 1_048_576, lineAttrs: true });
if (r.outcome === 'rendered') {
  showFragment(r.html); // the html is safe markup by the allowlist below
  for (const h of r.meta.headings) {
    const link = document.createElement('a');
    link.href = `#${h.id}`;
    link.textContent = h.text; // meta holds the author's plain text, never markup
    contents.append(link);
  }
}
```

`./render` runs unchanged in Node, browsers and workers. It imports no host API: no network, storage, DOM, Node built-in, clock or randomness, and it keeps no state between calls, so one input and one set of options always give the same output. The tests prove this by bundling it for the browser and running the whole corpus in an empty JavaScript context, where its output must equal Node's byte for byte.

**`render(markdown, options?)`** returns `{ html, outcome, bytes, meta }`.

| Field | Meaning |
|---|---|
| `outcome` | `'rendered'`; `'over-limit'` when the input is over `maxBytes` UTF-8 bytes (nothing is parsed and `html` is `''`); `'output-over-limit'` when the html would pass `maxHtmlBytes` (rendering stops there); or `'failed'` after an internal error. For the last two, `html` is the escaped source in a `<pre>` under one line saying so, cut to `maxHtmlBytes`. Never raw input HTML. |
| `html` | An HTML fragment. |
| `bytes` | The input's UTF-8 length; when over the limit, the count at which counting stopped (`maxBytes + 1`). |
| `meta.title` | The text of the first level-1 heading, or `null`. |
| `meta.headings` | Every heading: `{ level, id, text }`, in document order. |
| `meta.front`, `meta.frontList` | The front matter as a record with a null prototype (a list value stays a list) and as `{ key, list, vals }` entries in source order; both `null` when there is none. |
| `meta.figures`, `meta.tables` | How many Mermaid figures and tables were rendered. |
| `meta.mermaidKinds` | The distinct diagram keywords of the rendered Mermaid fences, in order, at most 32. |

Unless the outcome is `'rendered'`, `meta` is a frozen empty meta. Every string in `meta` (a heading's `text`, `title`, front-matter keys and values) is the author's plain text, not escaped: `<img src=x onerror=alert(1)>` in a heading arrives as those characters. Insert it with `textContent`, or escape it; never build markup from it. Only `html` is safe to insert as markup.

| Option | Default | Meaning |
|---|---|---|
| `maxBytes` | `DEFAULT_MAX_BYTES`, 4194304 (4 MiB) | UTF-8 byte cap on the input. Counting stops at the cap, so measuring an oversized input costs no more than the cap. It bounds the input only; `maxHtmlBytes` bounds the html. |
| `maxHtmlBytes` | 16777216 (16 MiB, four times `DEFAULT_MAX_BYTES`) | UTF-8 byte cap on the html. An input under `maxBytes` can still expand far past it (a reference definition with a long URL, used many times, repeats the URL at each use), so the html is counted as it is rendered and the render stops at the first piece that would pass the cap, with outcome `'output-over-limit'`. No ordinary document comes near the default. |
| `lineAttrs` | `true` | Put `data-line="a-b"` (the block's source lines) on block elements. |

Memory is linear in the size of the input (a document of nothing but short links took about 200 times its size), so size `maxBytes` to your heap and your worker's limit. Raising `maxHtmlBytes` removes the output bound that protects you from an input that expands past it, so raise it only for input you trust.

**`scanRefs(markdown, options?)`** parses without rendering and returns `{ outcome, images, imagesTruncated, mermaid }`: the distinct image sources `render()` would emit, in order and at most `maxImages` (default `DEFAULT_MAX_IMAGES`, 512) with `imagesTruncated` saying whether more exist, and the count and UTF-8 sizes (largest and total) of the Mermaid fences `render()` would turn into figures. It takes the same `maxBytes`, and its `outcome` is `'over-limit'` exactly when `render()`'s would be. The images and figures it lists are those of a successful render: when `render()` ends `'output-over-limit'` or `'failed'` it shows the escaped source and none of them.

### What it renders

- CommonMark with GitHub tables (wrapped in `<div class="table-wrapper">`; short rows are padded with at most 65536 empty cells in the whole document), strikethrough, task lists and footnotes. Raw HTML is off; only the allowlist below is recognised.
- Heading ids on every level: the heading's text lower-cased, spaces turned into `-`, and everything but letters, digits, `_`, `-` and CJK ideographs removed, with `-1`, `-2` and so on for repeats. Heading ids, `<!-- id:X -->` anchors and the footnotes' `fn1` and `fnref1` ids share one namespace with no prefix, so an author can write an id that another element also has, and ids may collide. A host must never look up an element of a rendered document by a document id (`getElementById`, `querySelector('#...')`, or a named property of `window` or `document`); it walks the fragment it inserted instead.
- Fenced code highlighted by highlight.js, in `<div class="codehilite"><pre><code class="hljs language-NAME">`. The language comes only from a fixed list (bash, shell, css, diff, dockerfile, go, ini, java, javascript, json, markdown, python, rust, sql, typescript, xml, yaml, plaintext, and their usual aliases); any other fence is escaped plain text, and the language is never guessed. Highlighting is bounded: a fence with a line over 256 characters, or one that would take a document past 256 KiB of highlighted code, keeps its language class and shows escaped plain text. A fence over 256 characters is highlighted one line at a time, so cost and output stay linear for every language (a block comment or multi-line string then colours its first line only); a shorter fence is highlighted whole. Highlighted code nests `<span>` elements at most about 170 deep (the 256-character line cap and the 256-character whole-block threshold bound it); the 64-level cap below applies to the allowlisted tags only.
- A `mermaid` fence becomes `<figure class="mermaid-figure"><pre class="mermaid">` with its source escaped as text. A paragraph right after it that is wholly `*Figure N. ...*` becomes its `<figcaption>`.
- `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]` blockquotes become `<div class="gh-alert gh-note">` callouts (uppercase markers only).
- YAML front matter at the very start, between `---` lines, becomes a `<dl class="doc-meta">` strip: at most 40 keys, values cut at 500 characters, lists at 50 items, and nothing at all for a block of 20000 characters or more. Scalars show the text the author wrote (`1.0`, `.inf`, `0o17`, `yes` and dates stay as written), except that `null` shows empty and booleans show `true` or `false`: the schema is YAML's failsafe one plus null, bool and the merge key `<<`, with no number types and no other tags.
- Links keep markdown-it's own check: `javascript:`, `vbscript:`, `file:` and non-image `data:` URLs stay text.

### The raw-HTML allowlist

The same list in every environment, exported as `ALLOWLIST`. Each form is matched exactly and emitted from fixed markup; everything else is escaped and shown as text.

| Input | Where | Output |
|---|---|---|
| `<br>`, `<br/>`, `<br />` | inline | `<br />` |
| `<sup>`, `<sub>`, `<kbd>` and their closers, with no attributes | inline | the same tag, lower case; past 64 open levels of one tag in a document, the opener and the closer that pairs with it stay text |
| `<!-- any comment -->` | inline, or a block of its own | nothing |
| `<!-- id:X -->` alone on its line, `X` matching `[A-Za-z0-9_-]{1,100}` | block | `<span class="doc-anchor" id="X"></span>` |
| `<details>`, `<details open>`, `</details>` alone on a line | block | the same tag; a stray closer is dropped, a details left open is closed at the end of the document, and past 64 open levels the opener and the closer that pairs with it stay text |
| `<summary>text</summary>` alone on a line | block | the same, with the text escaped |

## Embedding: `./enhance`

```ts
import { render } from '@synapsium-labs/docserver/render';
import { destroyEnhancement, enhance, setEnhancementPrefs } from '@synapsium-labs/docserver/enhance';
// Link @synapsium-labs/docserver/assets/reader.css as a stylesheet; its fonts load from ./fonts/ beside it.

const r = render(markdown);
showFragment(root, r.html); // the host inserts the safe html into its own root element
await enhance(root, {
  info: { title: r.meta.title, frontList: r.meta.frontList },
  storageKey: 'project-a:specs:example.md',
  storage: { snapshot: storedEntries, set: (key, value) => hostStore.write(key, value) },
});
setEnhancementPrefs(root, { theme: 'dark' }); // from the host's own settings control
await destroyEnhancement(root); // before the root is reused or removed
```

**`enhance(root, options?)`** returns a `Promise<void>` that resolves once the layout is built. Importing the entry does nothing: no DOM, storage, timer or network is touched until `enhance` is called. The library owns `root` and what it creates inside it, and nothing else. It marks `root` with `data-docreader-root` (the stylesheet's scope) and the prefs as `data-theme` (absent for `auto`, so the system colour scheme applies), `data-width` and `data-font`. Every element it creates carries `data-docreader-chrome`. The document's own nodes are only moved, never edited or re-created. It never writes `document.title`, `location`, `history` or any storage API, never looks an element up by a document id, and writes no HTML strings, so it runs under a strict Content Security Policy.

| Option | Default | Meaning |
|---|---|---|
| `prefs` | none | Starting prefs (`theme`: `auto`, `light` or `dark`; `width`: `standard` or `wide`; `font`: `serif` or `sans`). They override stored prefs and are not written back. |
| `storage` | none | The host's storage: `snapshot`, what it holds under this reader's keys, read during startup only; and `set(key, value)`, called after each local change (`null` deletes). Without it nothing persists and the reader still works. |
| `storageKey` | none | This document's key namespace, such as `project-a:specs:example.md`. Without it no per-document state persists. |
| `info` | from the DOM | `{ title, frontList }`, as `render()`'s `meta` holds them. Without it the title is the root's first `h1`. |
| `folds` | `true` | Section folding. |
| `signal` | none | An `AbortSignal`: aborting it during startup is `destroyEnhancement(root)`. Once `enhance` has resolved it does nothing. |

Options are read once, as plain data. A wrong type or an unknown key rejects with an `EnhanceError` whose `code` is `'invalid-options'`, and nothing is reserved. One root has one owner: calling `enhance` again on an enhanced root with the same options object (or with options omitted both times) returns the same promise; other options, or a root inside or around an enhanced one, reject with `'ownership'`. A destroy or abort during startup rejects with `'aborted'`, and a failure with `'initialization'`; either rejection comes after everything built so far has been undone.

**`destroyEnhancement(root)`** returns a `Promise<void>` that settles once cleanup has finished. Everything `enhance` did is undone, in reverse: what it created is removed, the document's nodes go back where they were, and every attribute and class it wrote is restored, unless the host has changed that value since, in which case the host's value stays. A destroy requested from inside one of the reader's own actions (a `set` call, say) stops that action at once, so nothing more is written, and the cleanup runs as the action returns. It does not wait for a pending `set` promise, and issues no new call. Repeated calls return the same promise; a root never enhanced resolves at once. If a cleanup step throws, the others still run and the promise rejects with an `AggregateError`; the root is released either way.

**`setEnhancementPrefs(root, prefs)`** changes the prefs of an enhanced root at once and writes them behind. A bad value throws `'invalid-options'`; a root that is not enhanced is left alone.

**Storage keys.** The reader's state lives under its own keys, and only those are read from `snapshot`:

| Key | Holds |
|---|---|
| `docreader:prefs` | The prefs, reader-wide: a JSON object such as `{"theme":"dark","width":"wide"}`. Fields this version does not know are kept when it is written back. |
| `docreader:doc:<storageKey>:folds` | The folded sections of one document: a JSON array of heading ids. |

A stored value that is not valid JSON, or not of its shape, is ignored. Writes go behind the local change: the reader changes at once, then calls `set`. Calls for one key are serialized, so a newer value never lands before an older one; while a call is pending only the newest waiting value is sent. A `set` that throws or rejects is ignored and changes nothing locally.

**What it builds so far.**

| Part | What the reader sees |
|---|---|
| Title block | An eyebrow above the title (the meta line's leading bold word, such as `**Spec**`, then the front matter's `type`, `area`, `status` and `kind`), and a byline below it. The byline is made from the meta line under the title, `**Spec** · 2026-10-19 · Status: Draft · **Owner:** project-a`: one fact per part, labelled by its `Label:` (a date is `Date`, and the first unlabelled part is `Status`), plus the reading time from three minutes up. The meta line itself is hidden. |
| Facts panel | The front matter's list keys (from `info.frontList`), in a closed `details` after the byline: `2 rules · 2 tags`, then each key and its values. Given `info.frontList`, `render()`'s front-matter strip is hidden. |
| "In short" | A level-2 heading named "In short" and its blocks, in a box. |
| "Where things stand" | Under a level-2 heading of that name, each level-3 heading and its blocks in a callout (Agreed, Waiting on you, Later, or other), and a line of counts before them when two or more have items. |
| Section numbers | A level-2 heading such as `3. Design` shows its number hanging in the margin. |
| Status marks | In a table column that reads as a status column (its header says Status, State, Result, Verdict, Outcome, Stands or Fate; or most of its short cells open on a status word), a cell's leading status word (agreed, done, pending, open, rejected, deferred, …) shows as a coloured mark. |

The document's text is never rewritten: where a word moves into a mark or a number, its text node is split and moved, and destroy joins it again.

**Folds.** Each level-2 section of a document gets a Fold button beside its heading. Folding hides the section's blocks with `hidden="until-found"`, so find-in-page still reaches them and opens the fold; a block the author hid stays hidden. Printing shows every section.

## The conformance corpus: `./conformance`

The corpus is the contract: what `render()` must produce, shipped with the package so any host can check its own renderer or build against it.

| Kind | Cases | Judged by |
|---|---|---|
| golden | 37 | `conformance/corpus/<id>.md` in, `conformance/expected/<id>.html` and `.meta.json` out, compared exactly |
| hostile | 15 | a golden, plus a verdict in `conformance/hostile.json` (strings that must never appear, bounds on depth and time) |
| generated | 30 | a verdict only; the input is built from a small spec on the consumer's machine (deep nesting, long delimiter runs, huge tables, comment and heading floods, pathological code, note floods, an over-limit input, an html expansion past `maxHtmlBytes`) |

Every case is also checked by an output-safety oracle: only known tags, attributes, classes and URL schemes may appear. Code inside a highlighted block is compared as text, so a host may use another highlighter's markup.

To run it in your own CI against the renderer you ship:

```js
import { render, scanRefs } from '@synapsium-labs/docserver/render';
import { runCorpus } from '@synapsium-labs/docserver/conformance';

const run = runCorpus(render, { scanRefs });
for (const r of run.results) if (!r.ok) console.error(r.id, r.failures.join('\n  '));
if (!run.ok) process.exit(1);
```

`runCorpus(renderFn, { only, scanRefs, timeScale })` returns `{ ok, total, passed, results }`, one result per case with its failures. Pass `scanRefs`, or the case that bounds image scanning fails and says so. `timeScale` multiplies every time bound for a slow machine; it never changes a verdict. `loadCorpus()` returns the cases themselves, and `normaliseForCompare`, `checkOutputSafety`, `evaluateVerdict`, `buildInput`, `inputSize` and `MAX_INPUT_BYTES` are exported for hosts that judge cases their own way.

### Departures from the reference renderer

The goldens were produced by the Python renderer these rules were ported from. The port matches it byte for byte except in these categories, each listed per case in `conformance/DEPARTURES.json` where it moves a file:

| Category | Departure |
|---|---|
| PD1 | Code highlighting: highlight.js replaces Pygments, so code inside `div.codehilite` is compared as text (no file moves). |
| PD2 | Front matter scalars render their source text: `null` renders empty, booleans render `true` and `false`, and every other scalar (`1.50`, `.inf`, `017`, `yes`, `on`, dates) stays as written, where the reference printed Python's values. The loader differs too: (a) array-index keys are listed first; (b) a last block scalar keeps its trailing line feed; (c) a sequence key loads as its items joined by commas; (d) nesting deeper than 100 levels fails the load; (e) merged keys are ordered by JavaScript's object order: a late `<<` puts them last, and a multi-source `<<` list keeps its sources' order, where PyYAML reverses the sources and lists merged keys first. A tag outside the schema (`!!int`, `!!float`, `!!binary`) fails the load. U+0085, U+2028 and U+2029 are not line breaks. A null list item renders empty. |
| PD3 | `meta.front` and `meta.frontList` come from the same front-matter block the strip renders, so CRLF files, `----` and `...` fences agree. |
| PD4 | One leading byte order mark is removed before parsing. |
| PD5 | Allowlisted tag names fold ASCII letters only; look-alike letters that only Unicode case folding equates stay text (no file moves). |
| PD6 | Reference labels and emphasis: markdown-it normalises a link's label with JavaScript's whitespace and the reference with Python's, so a label holding U+001C-U+001F, U+0085 or U+FEFF can match a different definition, or none. markdown-it also decides emphasis flanking from its own Unicode punctuation and symbol tables (uc.micro), which include five Unicode 15.1 symbols (U+2FFC, U+2FFD, U+2FFE, U+2FFF and U+31EF) that Python 3.12 reports as unassigned, so `a*㇯b*` renders `<p>a*㇯b*</p>` here and `<p>a<em>㇯b</em></p>` in the reference. This does not depend on the runtime (no file moves). |
| PD7 | A figure caption keeps the HTML balanced. It never comes from a tight list's hidden paragraph, never reaches past the block after its figure, and is made only from one emphasis span: `*Figure 1. a* *b*` stays an ordinary paragraph, where the reference emitted an unbalanced `Figure 1. a</em> <em>b` (moves the html of `figure-captions`). |
| PD8 | Bounds that only hostile documents reach: short table rows add at most 65536 empty cells in the whole document; html past `maxHtmlBytes` stops with `'output-over-limit'`; and author-written `details`, `sup`, `sub` and `kbd` tags nest at most 64 open levels each, a deeper opener and the closer that pairs with it staying text (no file moves); a footnote reference's own `<sup class="footnote-ref">` is the footnote plugin's and is not counted; and a front-matter key is cut to 500 code points, as a value is. |
| PD9 | Unicode tables follow the runtime, for three surfaces. Heading ids: the slug keeps `\p{L}` and `\p{N}` and lower-cases the way the runtime does. Caption digits: a figure caption's number is a run of `\p{Nd}`. Reference labels: a label is matched by `toLowerCase().toUpperCase()`. A code point that Unicode 15.0 (the reference's Python 3.12) leaves unassigned can therefore appear in an id, count as a caption digit or fold to a match here where the reference dropped it, kept the paragraph or found no definition, and two runtimes with different Unicode versions can disagree with each other (no file moves). |

A change that moves any file under `conformance/expected/` names the moved case ids in a `Goldens-moved: <id>, <id>` commit trailer, and a hostile verdict may only tighten: `node scripts/ratchet.mjs --base <ref>` refuses anything else, and CI runs it on every change.

## Build and test

Node 22 or later. Every dependency is pinned to an exact version and installed from the committed lockfile.

```sh
npm ci                            # install exactly what package-lock.json records
npm run typecheck                 # the whole tree, src/render alone with no host types, src/enhance with the DOM
./node_modules/.bin/vitest run    # every test; one file: ./node_modules/.bin/vitest run test/package.test.ts
npm run build                     # dist/ from src/
```

- Run the local `vitest` binary, never a bare `npx vitest`, which can resolve a different global copy.
- Tests never reach a network: `test/setup/no-network.ts` makes `fetch` and every socket connect throw, and the packing test runs npm offline.
- CI (`.github/workflows/ci.yml`) runs those four steps on Node 22 and 24, on pull requests and on `main`, then the verdict ratchet against the base branch (on a push, against `main` before the push), then `npm pack` and `scripts/consumer-smoke.mjs`, which installs the tarball in a throwaway project from the registry (with `--before` set 14 days back, so its transitive dependencies obey the age rule too) and runs the corpus through the package's public entries.
- A new or bumped dependency is an exact version at least 14 days old. Add it with
  `npm install --save-exact --before=<a date 14 days back> <name>@<x.y.z>`; npm then refuses a younger version.

## Design

The design lives in ccrc's spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3. The programme ledger is [`docs/superpowers/programs/docserver.md`](docs/superpowers/programs/docserver.md).

## Licence

MIT. See [`LICENSE`](LICENSE). Bundled third-party files keep their own licences, listed in `THIRD-PARTY-NOTICES` once they ship.
