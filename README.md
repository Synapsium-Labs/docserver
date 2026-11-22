# pinax-lib

One shared renderer for spec and plan documents written in Markdown. It turns Markdown into the rich reading layout: a contents sidebar, "In short" and "Where things stand" boxes, status labels, figure cards for Mermaid diagrams, quick jump, a glossary on hover, an Index of defined IDs, "Changes since", read marks, and light and dark themes.

It is pure. It does no network, storage, auth, git or hosting. Each product that uses it brings its own transport, login, content source and hosting, and pins one exact version.

**Status:** 1.1.0, a minor release after 1.0.0, the first release. `./render`, `./conformance` and `./enhance` are delivered, and so is the frame layer: `./frame`, `./host`, `./highlight` and the asset manifest `assets/assets.json`. Versions 1.0.0 and 1.1.0 were published as `@synapsium-labs/docserver`, the library's name before the rename; that name gets no further version, and once the first pinax-lib version is out it is deprecated with a pointer to `@synapsium-labs/pinax-lib`. The names the built frame and the bridge carry keep their names (the frame's `docserver:register` and `docserver:link` events, its own `docserver frame:` messages and its style-probe text, and every `data-docreader-*` attribute and `--dr-*` property), so the rename moves no golden file, no asset hash, no bridge protocol and no seed schema. Every version is published from a signed tag through the release lane (`.github/workflows/release.yml`); the Release verification section below checks one.

## What it holds

| Part | Entry point | Stage |
|---|---|---|
| Markdown rules (markdown-it, TypeScript): GitHub-style Markdown, alerts, figure captions, front matter, heading ids, a short raw-HTML allowlist | `@synapsium-labs/pinax-lib/render`: `render()`, `scanRefs()` | Delivered |
| The conformance corpus: Markdown in, expected HTML out, plus hostile cases | `@synapsium-labs/pinax-lib/conformance`: `runCorpus()`, `loadCorpus()` | Delivered |
| The rich layout over a rendered document: lifecycle, host adapters, reader prefs, navigation, reading position, state, editorial and index views, menus, comparison UI and read marks | `@synapsium-labs/pinax-lib/enhance`: `enhance()`, `destroyEnhancement()`, `goToHash()`, `setEnhancementPrefs()`, `setEnhancementAppearance()`, `runEnhancementCommand()`, `EnhanceError` | L2 implementation; final acceptance pending |
| The layout stylesheet and package fonts | `@synapsium-labs/pinax-lib/assets/*`: `assets/reader.css`, `assets/print.css` (print mode's, scoped under `.docreader-print`), `assets/fonts/` | L2 implementation; final acceptance pending |
| Self-hosted Mermaid and diagram controls | `@synapsium-labs/pinax-lib/assets/mermaid/*` through `mermaid.load()` | Still completing; final behavioral verification pending |
| The sealed reader frame's document builder, its policy and the bridge's protocol (pure) | `@synapsium-labs/pinax-lib/frame`: `frameDocument()`, `frameCsp()`, `checkFrameCsp()`, `mermaidGate()` | L3 |
| A reference parent that mounts the frame for other viewers | `@synapsium-labs/pinax-lib/host`: `mountDocFrame()` | L3 |
| The code highlighter `render()` uses, for a host that colours code itself | `@synapsium-labs/pinax-lib/highlight`: `createHighlighter()` | L3 |
| The frame's hashed scripts and stylesheet, and the manifest of every asset | `@synapsium-labs/pinax-lib/assets/*`: `assets/frame/`, `assets/mermaid/mermaid.frame.js`, `assets/assets.json` | L3 |

The package exports exactly `./render`, `./conformance`, `./enhance`, `./frame`, `./host`, `./highlight`, `./assets/*` and `./package.json`; nothing else is importable.

## Rendering: `./render`

```ts
import { render, scanRefs } from '@synapsium-labs/pinax-lib/render';

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
| `meta.items` | The item values the reader would ask its host `itemLink` for (`AB-12`: a capital, 1 to 9 capitals or digits, a dash, a number), in document order, each once, at most 50, each at most 100 code units (a longer one is left out, not cut). Empty unless `reader` names item fields or headings. See "Item values" below. |

Unless the outcome is `'rendered'`, `meta` is a frozen empty meta. Every string in `meta` (a heading's `text`, `title`, front-matter keys and values) is the author's plain text, not escaped: `<img src=x onerror=alert(1)>` in a heading arrives as those characters. Insert it with `textContent`, or escape it; never build markup from it. Only `html` is safe to insert as markup.

| Option | Default | Meaning |
|---|---|---|
| `maxBytes` | `DEFAULT_MAX_BYTES`, 4194304 (4 MiB) | UTF-8 byte cap on the input. Counting stops at the cap, so measuring an oversized input costs no more than the cap. It bounds the input only; `maxHtmlBytes` bounds the html. |
| `maxHtmlBytes` | 16777216 (16 MiB, four times `DEFAULT_MAX_BYTES`) | UTF-8 byte cap on the html. An input under `maxBytes` can still expand far past it (a reference definition with a long URL, used many times, repeats the URL at each use), so the html is counted as it is rendered and the render stops at the first piece that would pass the cap, with outcome `'output-over-limit'`. No ordinary document comes near the default. |
| `lineAttrs` | `true` | Put `data-line="a-b"` (the block's source lines) on block elements. |
| `highlight` | `true` | Colour code fences with highlight.js. With `false` every fence keeps its wrapper, its `data-line` and its `language-NAME` class and holds the code as escaped text, with no span; nothing else changes. Any value but a boolean is a TypeError. A host that colours code itself does it with `./highlight`, which gives `render()`'s own markup. |
| `reader` | none | The reader's vocabulary, the same `{ status, statusHeaders, …, itemFields, itemHeadings }` shape as the reader's `vocabulary` option and the frame's `features.vocabulary` (it is the type `ReaderVocabulary`, held equal to both, except that `reader` also takes `rules` (a boolean, default `false`, which only print mode reads), which the other two do not: a `reader` object with `rules` handed to `features.vocabulary` is an `invalid-input`). `meta.items` reads `itemFields` and `itemHeadings` from it; each defaults to none. A value that is not a plain object, a key the vocabulary does not have, a getter, or any list, group or grammar the reader's own `features.vocabulary` would refuse (a list is up to 200 words of 1 to 64 code units with no white space at either end), is a TypeError, before the byte gate. |
| `print` | `false` | Print mode, below. Any value but a boolean is a TypeError. The `'failed'` and `'output-over-limit'` fallback blocks are returned as they are without `print`, outside `div.docreader-print`. |

**Print mode.** With `print: true`, `render` writes statically the blocks the reader builds on the page's DOM, so a host can print a document without the browser reader. The html is one `div.docreader-print` holding the document, with, as the reader places them: the eyebrow (`div.eyebrow`) above the title; the byline (`dl.byline`: one `div` per fact, the reading time as `div.rt`) after it; the review strip (`section.review-strip`) after the byline; the facts panel (`details.doc-facts`, open) from the front matter; `span.sec-no` on numbered headings; the `div.short` and `div.callout` boxes; `span.pill` status labels in status columns of tables; and a plan's marks: `span.task-id` with `span.tmeta` (step count, owner) on each task heading, `span.step-no` with `span.who` on each step, and `li.attn` on a step that names the reader. The strip holds `div.rs-wait` ("Waiting on you · N" and an `ol` with each waiting item whole, never clipped and never a link), and `p.rs-facts` with the decisions fact (`N <group>`, one `span.cnt` per status word, each its number and its word) and the plan fact (`T tasks · S steps`, `N yours`), separated by `span.sep`. The plan fact is printed under the screen's own rule, for a plan of 20 steps or more (the outline mode's length); a shorter plan prints no plan fact, as on the screen, while its task chips and step labels are printed whatever its length. With `reader.rules` on, rule paragraphs (`p.rule` with `span.rule-head` and its status pills) and the rules index in the facts panel are printed too. What the reader hides (the number's full stop, a step's brackets and colon, the meta line the byline replaces, the `nav` of links to the boxes) is not printed, a link of the reader's chrome has no print, and a figure stays its source (`figure.mermaid-figure > pre.mermaid`), for the host to replace with a picture. Every `details` is open and no element is `hidden`. The text is the document's, escaped; the only attributes written are `class`, `id`, `data-line`, `open`, `colspan`, `rowspan`, `align`, `alt`, `title` and `href`, and an `img`'s `src` (the image reference as `render` wrote it, which the host resolves through its image map, dropping a reference it has not loaded); a table's `text-align` style becomes `align`, and a task's checkbox the text of its box (`span.task-check`). A host derives its print allow-list from `conformance/print/vocabulary.json` (shipped with the package): `elements`, `classes`, and two open class `families` that are prefixes, `hljs-` (highlight.js token classes) and `language-` (a code block's language), over the corpus and the print fixtures with `rules` on. The stylesheet is `assets/print.css` (`@synapsium-labs/pinax-lib/assets/print.css`), every rule of it under the root class `.docreader-print`: light palette, 11 pt text, every section unfolded, figures, code and table rows kept whole, the separators in the muted text colour. Print mode reads render's own html, in which every `<` of the document is an entity, so a tag in the Markdown source stays text. The `'failed'` and `'output-over-limit'` fallback blocks are not wrapped. `print` changes nothing without it: the html and the meta are byte for byte what they were. The fixtures and their pinned output (reformatted with a line break between tags, for review) are `conformance/print/`.

**Item values.** A document may name a tracker item (`AB-12`), and the reader draws a link for it when its host answers `itemLink(key)` (see `./enhance`). The library carries no tracker, so `render` tells the host which values a document names and the host resolves them. With `reader: { itemFields: ['Tracker'], itemHeadings: ['Delta'] }`, `meta.items` lists, in document order and each once, the keys the reader reads by its three routes and no others: the keys in the first byline fact (the line under the title, `**Spec** · 2026-10-12 · Tracker: AB-12`) labelled with an item field, outside a link, and the whole text of a `code` element there; and the key on the `item: AB-12` line that opens the first code block of the first level-2 section whose heading is an item heading (a section whose first code block names none passes to the next); and, for a document whose header predates the byline, the keys of a header line (used only when the byline has no item fact and the host gave no link for a delta key). The header zone is the elements after the title (the first level-1 heading) up to the first level-2 heading, or from the start of the document when there is no title; content before the title is not a header. In the zone, each paragraph and each blockquote's first paragraph, except the meta line, is read, and in the first that has one the label of an item field is found anywhere in it: a bold `**Tracker:**` (the colon inside the bold text or right after it) or a plain `Tracker:` at the start of a line. A header is several lines in one paragraph (soft line breaks, as in `**Status:** Draft` / `**Tracker:** AB-90` / `**Author:** someone`), so the keys are those of the text from the label to the end of that line, which a newline, a `<br>` or the next bold label ends. A key in the body, a list, a table or a heading is no item. The reader asks for at most 16 keys and draws at most 64 links in a document; the list holds up to 50. The reader asks for the delta key first, for the byline's only when the host gave no link for it, and for the header line's only when neither gave one, so the list names all of them. The host's `./host` adapter `items` resolves them into the seed (see "Hosting"), and `runCorpus` leaves an empty `items` out of the meta it compares, so no golden moves.

Memory is linear in the size of the input (a document of nothing but short links took about 200 times its size), so size `maxBytes` to your heap and your worker's limit. Raising `maxHtmlBytes` removes the output bound that protects you from an input that expands past it, so raise it only for input you trust.

**`scanRefs(markdown, options?)`** parses without rendering and returns `{ outcome, images, imagesTruncated, mermaid }`: the distinct image sources `render()` would emit, in order and at most `maxImages` (default `DEFAULT_MAX_IMAGES`, 512) with `imagesTruncated` saying whether more exist, and the count and sizes of the Mermaid fences `render()` would turn into figures: the largest and the total in UTF-8 bytes (`largestBytes`, `totalBytes`) and in UTF-16 code units (`largestChars`, `totalChars`, the unit `mermaidGate()` reads). It takes the same `maxBytes`, and its `outcome` is `'over-limit'` exactly when `render()`'s would be. The images and figures it lists are those of a successful render: when `render()` ends `'output-over-limit'` or `'failed'` it shows the escaped source and none of them.

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
import { render } from '@synapsium-labs/pinax-lib/render';
import { destroyEnhancement, enhance, setEnhancementPrefs } from '@synapsium-labs/pinax-lib/enhance';
// Link @synapsium-labs/pinax-lib/assets/reader.css as a stylesheet, or import it where a bundler handles CSS
// (the package marks its .css files as having side effects, so the import is kept); its fonts load from ./fonts/.

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

**`enhance(root, options?)`** returns a `Promise<void>` that resolves once the layout is built. Importing the entry does nothing: no DOM, storage, timer or network is touched until `enhance` is called. The library owns `root` and what it creates inside it; outside it, it only listens for `beforeprint` and `afterprint` on the root's window, to show folded sections in print. It marks `root` with `data-docreader-root` (the stylesheet's scope) and the prefs as `data-theme` (absent for `auto`, so the system colour scheme applies), `data-width` and `data-font`; the product lens is the root class `lens-product`. Every element it creates carries `data-docreader-chrome`. The root can additionally carry feature-state classes such as `has-toc`, `toc-open`, `bar-hidden`, `outline` and `ver-on`, and Mermaid progress is exposed as `data-docreader-diagrams` with `on-request` (figures are drawn only on a reader's tap), `waiting` (`'after-ready'`: the build has not arrived yet, so every figure is still readable source), `drawing`, `drawn`, `partial` or `failed`. These markers are reader-owned and are removed or conditionally restored by `destroyEnhancement`.

The document's own nodes are never re-created and their text is never re-typed: they are moved, and where a word moves into a mark or a number its text node is split in two without changing a character. On the document's own elements the reader also sets `hidden` (the meta line, folded blocks), `aria-label` (headings), `data-label` (the cells of a table that stacks on a phone) and classes (`folded` on headings; `stack` and `cols-2` on table wrappers; `group` on table rows). Destroy joins every split and restores every attribute and class. It never writes `document.title`, `location`, `history` or any storage API, never looks an element up by a document id, and writes no HTML strings, so ordinary enhancement runs under a strict Content Security Policy. Mermaid drawing needs the reader policy's `style-src 'unsafe-inline'` for Mermaid's styles; scripts remain restricted to the page origin. Its type declarations name DOM types, so a TypeScript consumer of `./enhance` needs the DOM library (`"lib": ["ES2022", "DOM"]`, say).

| Option | Default | Meaning |
|---|---|---|
| `prefs` | none | Starting prefs (`theme`: `auto`, `light` or `dark`; `width`: `standard` or `wide`; `font`: `serif` or `sans`; `lens`: `all` or `product`, the reading lens, which quiets implementation detail without removing it). They override stored prefs and are not written back. |
| `appearance` | none | A host's appearance (the contract of the `./frame` section "The appearance contract"): any value, judged slot by slot by `parseAppearance`; one that is not a plain object leaves the mount as it is. It is applied in the same synchronous run as the prefs, before the first paint, and the mount is hosted for life: the verdict's colours and skin are written to the root as custom properties, its `mode` replaces the `theme` pref (the stored theme is ignored and never written; `setEnhancementPrefs` ignores a `theme`), and Aa shows one line of plain text, the verdict's `label` or the default, in place of its theme row. |
| `storage` | none | The host's storage: `snapshot`, what it holds under this reader's keys, read during startup only; and `set(key, value)`, called after each local change (`null` deletes). Without it nothing persists and the reader still works. |
| `storageKey` | none | This document's key namespace, such as `project-a:specs:example.md`: a non-empty string of at most 1024 code units. Without it no per-document state persists. |
| `posKey` | `storageKey` | The key namespace of this document's reading position, so a host can store the position apart from the rest (per tab, say): a non-empty string of at most 1024 code units. Without it or `storageKey` the position has no key. |
| `info` | from the DOM | `{ title, frontList, sha, draft, commits, only }`. `title` and `frontList` as `render()`'s `meta` holds them; without them the title is the root's first `h1`. `sha` is the commit of the version shown; `draft` says the version shown is not a commit (default `false`); `commits` lists the document's commits, newest first, as `{ sha, subject, date, parents }` (`date` is text the reader shows as given, such as an ISO 8601 date; its form is not checked); and `only` is the base commit of a one-day view: the version at `sha`, with the changes since `only` marked. A sha is 7 to 40 hex characters, or exactly 64, in either case, and is kept in lower case. Only the first 100 commits are read, a subject is cut to 200 code units, and the first 16 parents are kept; a date over 64 code units refuses the options. `frontList` keeps its first 40 entries and each `vals` its first 300 items, as `render()` bounds them. |
| `folds` | `true` | Section folding. |
| `keyboard` | `true` | Single-key shortcuts. |
| `chrome` | each `true` | `{ bar, rail, settings, topSpace }`: which parts of its own chrome the reader builds: the bar at the top of the root, the contents rail (a drawer on a narrow screen), and the reading settings menu; `topSpace: false` trims the root's top padding to 8 px for a root with no bar (a host that supplies its own space above the text); with the bar on it changes nothing. A host with a bar of its own turns `bar` off, and reaches the bar's tools through `runEnhancementCommand`; a host whose own bar is a fixed header over the text may set `--bar-h` on the root to its height, which must be a length (`0px`, never a unitless `0`); with the bar off the reading settings button (Aa) stays, at the root's top right, and `settings: false` removes it. |
| `onProgress` | none: no report | `onProgress(share)`: how far the root has been read, a number from 0 to 1 (the share the bar's progress line draws), called once when the reader starts and then on every change, with or without the bar. A root wholly above the window reports 0. |
| `onPlace` | none: no report | `onPlace(kind)`: the full-screen figure opened (`'overlay'`) or closed (`'overlay-closed'`), for a host that keeps a history entry for it. Only the figure is a place: the keys sheet, the quick jump, the settings, the changes menu, the drawer and the card are not. Closed by Esc, its Close button or a reveal, it reports once; closed by the `'close-overlay'` command, it reports nothing (the host asked for it). |
| `onPrintFigure` | none: no `print-figures` command | `onPrintFigure({ i, n, png })`: with it the `'print-figures'` command exists. The reader draws each Mermaid figure again for print (offscreen, apart from the screen's drawing, through the same queue: HTML labels off, `htmlLabels` among the secure keys, the screen's theme or the host's colours, the one font an SVG image can use), rasterises it on a canvas at twice its size shrunk to fit 2048 px a side, and hands it over as `png` (base64 text of a PNG of at most 1 MiB), in document order, `i` of `n` (the figure count, at most 64). The reader waits for what the callback returns (a promise or nothing) before it draws the next figure. A figure that does not draw, whose image fails to load, whose canvas is tainted or whose PNG is over 1 MiB is skipped: its `i` is never handed over. A second command cancels the first run's remaining figures. |
| `rules` | `false` | Rule paragraphs and the rules index. |
| `inShort` | `false` | The "Headlines / Full" switch of the "In short" box. On, the box carries two buttons, `Headlines` and `Full`, `aria-pressed` on the chosen one: Full shows every item, Headlines only each item's lead (its first strong run, else its first sentence; in a loose list, an item with no strong run shows its whole first paragraph) and hides the rest from view and from the accessibility tree. The choice is kept in the reader-wide UI memory (the `inshort` field of `<namespace>:ui`), Full by default. Off, the box is as it always was. |
| `changesBase` | none | A commit to compare the document with, a sha of 7 to 40 hex characters or 64 (anything else is `invalid-options`). With `changes` and a commit version (`info.sha`, not a draft) the reader asks `changes(changesBase)` once when it starts and shows the comparison as "Changes since" shows one (marks and the stepper, with no jump), labelled "Since" and the base commit's subject when `info.commits` names it, else "Since your comparison". No other source sets it. |
| `initialHash` | none | The id to open the document at, without `#`: a heading id or a defined ID. Empty or `null` is none, and one over 1024 code units is ignored. |
| `onLink` | none: the browser follows the link | `onLink(href, { newTab })`: a link the reader was asked to follow, with its `href` as written. Routing is the host's. |
| `onHash` | none | `onHash(id, { push, from })`: the reader went to `id` (`null`: no section). `push` asks for a new entry in the host's history, and `from` is an opaque token for the place being left, for the host to hand back when its history returns there. The reader never touches the page's address or history itself. |
| `copy` | none: no Copy buttons | `copy(text)`, returning, or resolving, once the text is copied. A throw or a rejection shows as a failed copy. |
| `changes` | none: no comparison | `changes(sha)`: a promise of the document's changes since commit `sha`. Its accepted reply is `{ changed: [from, to][], removedAfter?: number[] }`: each range covers inclusive source-line bounds in host order, and every bound and optional `removedAfter` value is a finite integer where the range start is no greater than its end. `removedAfter: 0` marks removals at the very start. At most 10000 ranges and 10000 deletions are accepted; line values are clamped to the line after the document ends. An unavailable reply (not an object with a `changed` array, including a getter failure or host throw/rejection) does not start a new comparison or clear one already shown, while an invalid reply (bad range, deletion or cap) reads as an empty comparison. |
| `openVersion` | none | `openVersion({ sha, only })`: show the version at `sha` with the changes since `only` marked (one day's version), or, with `{ sha: null, only: null }`, go back to the latest. |
| `itemLink` | none: no item links | `itemLink(key)`: the link for an item key the document names, or `null` for none. It is called only where `vocabulary.itemFields` or `vocabulary.itemHeadings` matches; both default to empty, so an `itemLink` callback alone is never called. It asks at most 16 keys and writes at most 64 links. A result must be a string of 1 to 2048 code units with no white space or control character, and use an http or https scheme; any other result is ignored. |
| `mermaid` | none: figures show their source | `{ load, maxTextSize, maxEdges, secure }`. `load()` resolves with Mermaid's module: the host passes the file, never a URL. `maxTextSize` (an integer from 1 to 1048576) and `maxEdges` (from 1 to 50000) bound one diagram; left out, the library's pinned values apply. `secure` lists up to 64 configuration keys that a diagram's own directive may not set, added to the library's list: it can only add keys. Each is a top-level key name, a letter then up to 63 letters, digits or `_` (`themeCSS`, not `flowchart.htmlLabels`); any other entry, or a longer list, refuses the options. |
| `vocabulary` | the neutral defaults | The words the host's documents use: `{ status: { ok, wait, no, info }, statusHeaders, rulingHeaders, attention: { status, who, question, openAnswers, blocking, risk, openStatus }, ids, ruleIds: { prefixes }, qualifiers, plan: { task, step, who }, addressees, itemFields, itemHeadings }`. Each list is plain words, never a pattern: every character is itself, and most lists match in any case. Where a list is read as whole words, a word is whole in any script: where it ends in a letter, a digit, a combining mark or `_`, the text has none of those right beyond it; where it ends in anything else (`done!`, `✓`), that edge asks nothing of the text. A list given replaces its default whole, and an empty one matches no word (a header that ends in "?" still names a ruling). `ids` is `false` (no IDs) or `{ prefixes }`. A list holds at most 200 words, each 1 to 64 code units with no white space at either end. |
| `namespace` | `docreader` | The prefix of every storage key: a lower-case letter, then up to 31 lower-case letters, digits or dashes. |
| `signal` | none | An `AbortSignal`: aborting it during startup is `destroyEnhancement(root)`. Once `enhance` has resolved it does nothing. |

The documented options are the L2 contract. Features decide whether to present their controls from the options and available document data: `chrome` suppresses the reader-owned bar, rail or settings menu; no `copy`, `changes`, `openVersion` or `itemLink` callback means the corresponding action is absent. The `mermaid` drawing and diagram-tool path uses the supplied `mermaid.load()` module and its documented limits.

Options are read once, as plain data: only an object's own properties count, enumerable or not (an inherited one is not read), and a getter is refused without being called; the same holds for `prefs`, `info`, `chrome` and `mermaid`, and for each entry of `info.frontList`, `info.commits` and `mermaid.secure`. An array is read item by item, never through a method or iterator of its own, and a hole counts as a wrong value. A wrong type, a getter or an unknown own key rejects with an `EnhanceError` whose `code` is `'invalid-options'`, and nothing is reserved; a commit entry may carry fields of its own, which are not read.

**Host callbacks.** `onLink`, `onHash`, `copy`, `changes`, `openVersion`, `itemLink`, `onProgress`, `onPlace`, `onPrintFigure` and `mermaid.load` are the host's adapters for what the reader must not do itself: follow a link, change the address, use the clipboard, fetch, or load a module. Each must be a function in an own data property. Reading the options never calls one, nor reads anything from it. The reader calls it later as a method of the object it came from (the options object, or `mermaid` for `load`), only while the root is enhanced and only from inside one of its own actions, so a destroy requested from inside a callback takes effect when the callback returns. A callback that throws, or (for `copy`, `changes` and `load`, whose promises the reader waits for) whose promise rejects, counts as failed and the reader carries on; nothing is called once a destroy has begun, and a reply that arrives after it, or from a callback that requested it, is ignored. Each object the reader hands a callback (`{ newTab }`, `{ push, from }`, `{ sha, only }`) is a new frozen object, and whatever a callback returns is checked before use. Whether a callback was given decides what the reader builds (no Copy buttons without `copy`, say), never what it returns. The reader calls the function itself, never a `call` property of it. A promise's machinery is not one of the reader's actions: the `then` of a thenable a callback returns, and any getter on what it resolves with, run outside them, so a destroy requested there takes effect at once, and the reply is ignored.

One root has one owner: calling `enhance` again on an enhanced root with the same options object (or with options omitted both times) returns the same promise; other options, or a root inside or around an enhanced one, reject with `'ownership'`. That check runs again once the options are read, so host code that runs while they are read (a Proxy's traps) cannot make a second owner. Keep an enhanced root in its document: `destroyEnhancement` and `setEnhancementPrefs` still find a root that was moved to another one, and a root inside it is still refused, but a root around it there is not. A destroy or abort during startup rejects with `'aborted'`, and a failure with `'initialization'`; either rejection comes after everything built so far has been undone.

**`destroyEnhancement(root)`** returns a `Promise<void>` that settles once cleanup has finished. Everything `enhance` did is undone, in reverse: what it created is removed, the document's nodes go back where they were, and every attribute and class it wrote is restored, unless the host has changed that value since, in which case the host's value stays. An attribute the library removed comes back at the end of its element's attribute list, so a serialization can differ in attribute order only; that happens to a `data-theme` the host put on the root itself, which the reader owns while enhanced (pass `prefs` instead). If the host removes or merges the node that followed one the reader moved (`root.normalize()` merges the separators left in the hidden meta line, say), that node still goes back into its old parent, next to where it was, and the promise rejects with an `AggregateError` that says so. A destroy requested from inside one of the reader's own actions (a `set` call, say) stops that action at once, so nothing more is written, and the cleanup runs as the action returns. It does not wait for a pending `set` promise, and issues no new call. Repeated calls return the same promise; a root never enhanced resolves at once. If a cleanup step throws, the others still run and the promise rejects with an `AggregateError`; the root is released either way.

**`runEnhancementCommand(root, name, args?)`** runs one of the bar's tools without the bar and answers a boolean: `'jump'` (the quick jump), `'settings'` (the reading settings), `'contents'` (the contents drawer) or `'outline'` (a plan's Outline). Each toggles its overlay as its bar button did, and Escape and the overlay's own close still work. It answers `false`, and changes nothing, for a root that is not enhanced, an unknown name, a tool that is turned off or absent from this document (`chrome.settings: false`, no contents rail, no plan outline), a toggle that would open while another overlay is open, and `'contents'` where the rail is shown (a window of 1240 px or more, which has no drawer). A command closes its own overlay when it is open, so a host's own button toggles, provided the host runs the command synchronously from that button's own click handler: a press outside the reading settings menu closes it first, and the same gesture's click is what the command then sees, so a command run later (after an `await`, in a microtask or in a framework effect) finds the gesture over and a second press opens the menu again. The host's button must also sit outside the reader's root: a click inside the root ends the gesture before the host's handler runs, so a button placed inside it does not get the same-gesture toggle. A host that sets `chrome.bar: false` now gets the reading settings button (Aa) at the root's top right; `chrome.settings: false` leaves it out. Two more names are the host's history moving, not tools: `'close-overlay'` closes the full-screen figure when it is open (and answers `false` when it is not), without an `onPlace` report of its own; `'goto'` takes `args`, `{ id, from? }`, and goes where the host's history moved, as `goToHash(root, id, from)` does (back to the place `from` names, else to `id`, calling no `onHash`), answering `false` for arguments of another shape. `'print-figures'` starts a print run (see `onPrintFigure`), answers `true` when it started, and `false` when the host gave no `onPrintFigure` or the document has no figure to print. It answers `true` also when every figure is too long for Mermaid to draw: the run starts and ends having handed over nothing. With the seed's `mermaid.draw` at `'after-ready'` the run waits for the diagram engine the host sends after `ready`, and waits for good if that build never arrives (no figure comes back and no failure is reported), so a host that prints in that mode times the run itself. Each figure comes back through `onPrintFigure`, none is drawn on screen.

**`setEnhancementPrefs(root, prefs)`** changes the prefs of an enhanced root at once and writes them behind. A bad value throws `'invalid-options'`; a root that is not enhanced is left alone. A change made while `enhance` is still starting (waiting for an earlier destroy of the same root, say) is kept and applied as soon as it builds.

**`setEnhancementAppearance(root, appearance)`** hands an enhanced root a new host appearance, in place: the same root, no remount, applied at once. A value that is not a plain object changes nothing, a bad slot is left out by the validator, and a verdict with no colour group removes every host colour. It makes a mount that had none hosted, for good. It emits the reader's `prefs` event and an `appearance` event, and a change of `controlRow` alone closes an open popover and asks for one relayout. A root that is not enhanced is left alone; the call never throws.

**`goToHash(root, id, from?)`** is `onHash`'s other half: when the host's own history moves to an entry of this document (its `popstate`), it passes that entry's id (`null` for none) and the `from` token it was handed when the reader left that entry, and the reader goes back to that place when the token has the shape the reader writes (checked like a stored position, whoever made it), else to `id` when it names something in the document (an id that names nothing does nothing), else, for `null`, to the top, calling no `onHash`; it does nothing for a root that is not enhanced or still starting.

**Storage keys.** The reader's state lives under its own keys, and only those are read from `snapshot`. The default namespace is `docreader`, giving keys such as `docreader:prefs` and `docreader:doc:<storageKey>:folds`. Every per-document value uses `<namespace>:doc:<storageKey>:<name>`; the current names and their shapes are listed below.

| Key | Holds |
|---|---|
| `<namespace>:prefs` | The prefs, reader-wide: a JSON object such as `{"theme":"dark","width":"wide","lens":"product"}`. Fields this version does not know are kept when it is written back. |
| `<namespace>:doc:<storageKey>:folds` | Folded section heading ids: a JSON array of strings; `null` clears it. |
| `<namespace>:doc:<storageKey>:marks` | Read-mark fingerprints: a JSON object from current section or task heading id to its fingerprint string; `null` clears it. |
| `<namespace>:doc:<storageKey>:outline` | Whether a long plan opens in outline mode: JSON `true`; `null` clears it. |
| `<namespace>:doc:<storageKey>:ixfold` | Collapsed index groups: a JSON object whose group names have value `true`; `null` clears it. |
| `<namespace>:doc:<storageKey>:seen` | Last seen committed version: a JSON object `{ "sha": string, "at": number }`. |
| `<namespace>:pos:<posKey>` | The reading position of one document: a JSON object such as `{"line":"12-14","offset":40,"y":900}` (the block at the reading line, by its source lines or its id, its top in the window, and the scroll position), read during startup and written once scrolling stops and when the page is hidden; `initialHash` wins over it. A host that wants the position kept per tab routes these keys to its session storage. With two roots in one window, a root the reader is not in keeps no place. |
| `<namespace>:ui` | Reader-wide interface memory, including the contents rail's selected tab. |

With the default namespace these are `docreader:pos:<posKey>` and `docreader:ui`; a custom `namespace` replaces only the `docreader` prefix.

A stored value that is not valid JSON, or not of its shape, is ignored. Writes go behind the local change: the reader changes at once, then calls `set`. Calls for one key are serialized per storage object, across every root given that object (two roots on one page, or a root enhanced again after a destroy), so a newer value never lands before an older one; while a call is pending only the newest waiting value is sent, and a `set` that calls back into the reader (to re-apply the host's own settings, say) queues that change behind its own call. The prefs object is written as this root's snapshot of it with its own changes, merged under a newer value another root queued on that storage object when the snapshot cannot hold that value (queued after the snapshot was read, or still in flight then), so one root never drops a field another wrote, nor writes back a value the host's store has since replaced. Pass the same storage object to every `enhance` that shares a store: two objects are two queues. A `set` that throws or rejects is ignored and changes nothing locally.

**What it builds so far.**

| Part | What the reader sees |
|---|---|
| Title block | An eyebrow above the title (the meta line's leading bold word, such as `**Spec**`, then the front matter's `type`, `area`, `status` and `kind`), and a byline below it. The byline is made from the meta line under the title, `**Spec** · 2026-10-19 · Status: Draft · **Owner:** project-a`: one fact per part, labelled by its `Label:` (a date is `Date`, and the first unlabelled part is `Status`), plus the reading time from three minutes up. The meta line itself is hidden. |
| Facts panel | The front matter's list keys (from `info.frontList`), in a closed `details` after the byline: `2 rules · 2 tags`, then each key and its values. Given `info.frontList`, `render()`'s front-matter strip is hidden, so a scalar key other than `type`, `area`, `status` and `kind` (which the eyebrow shows) is shown nowhere, as in the reader this was ported from; an open point. |
| "In short" | A level-2 heading named "In short" and its blocks, in a box. |
| "Where things stand" | Under a level-2 heading of that name, each level-3 heading and its blocks in a callout (Agreed, Waiting on you, Later, or other), and a line of counts before them when two or more have items. |
| Section numbers | A level-2 heading such as `3. Design` shows its number hanging in the margin. |
| Status marks | In a table column that reads as a status column, a cell's leading status word (agreed, done, pending, open, rejected, deferred, …) shows as a coloured mark. A column reads so when its header holds Status, State, Result, Verdict or Outcome (or their plurals), Stands or Fate as a whole word (`Current status` does, `Statement` does not); or its header holds ruling, ruled or answer, or ends in a question mark, and at least half its filled cells open on a status word; or it has three or more filled cells, none over three words, and at least 60% of them open on one. The first column never does. |
| Tables | A table of two columns (Term \| Meaning and the like) keeps to the reading column; a wider one takes the width its content needs, from the reading column's up to the wide width. On a phone a table of three or more columns stacks into cards, each cell under its column's name. A body row whose only filled cell is the first is a group heading inside the table. |

**Safari: a byline with very many separators is slow.** In WebKit, building the screen's byline and undoing it grow faster than linearly in the number of its separators. CI measured (runs 44908932707 and 44912462614, both Node legs), at 4 000 separators in 5 text nodes and 10 000 in 2: build 0.33 to 0.59 s and 1.5 to 2.4 s, undo 0.32 to 0.72 s and 1.8 to 5.2 s. Chromium builds 32 000 in 1.2 to 1.3 s and undoes them in 0.06 to 0.08 s. A byline of the size real documents have (tens of separators) is not affected. Two fixes did not make it linear: a separator scan that never slices the remaining text, and a build and undo done with the paragraph off the document. The cause inside WebKit is not identified; finding it needs a WebKit profile.

The document's text is never rewritten: where a word moves into a mark or a number, its text node is split and moved, and destroy joins it again.

**Diagrams.** A Mermaid figure keeps its source as readable fallback text. When the host supplies `mermaid.load()`, the reader draws beside that source with the supplied module and the `maxTextSize`, `maxEdges` and additive `secure` limits; its root state reports drawing progress. Figure actions are chrome controls: they do not create a navigation entry. The fixed-position preview has a host constraint: avoid a transformed, filtered or perspective-bearing containing ancestor, including one that establishes a fixed-position containing block through CSS `contain`. The final behavioral verification of drawing and diagram tools remains pending with Task 24.

**The stylesheet and the root's box.** The library owns the root's box as well: the stylesheet sets its background, type and padding, and its `max-width` to none and its `margin` to 0, over a host rule of ordinary weight. Its gutter is the root's own, so a root narrower than its parent keeps a full reading column, and every size is computed from the root, never from the host page's `html` font-size. Its narrow rules (section numbers that stop hanging, the phone layout with tables as cards) follow the viewport, not the root: a root that fills its frame or its page gets them right, and one shown in a narrow column of a wide page keeps the wide layout, so give it a frame of its own there.

**Folds.** Each level-2 section of a document gets a Fold button beside its heading. Folding hides the section's blocks with `hidden="until-found"`, so find-in-page still reaches them and opens the fold; a block the author hid stays hidden. Printing shows every section.

### Format Contract And Layout Differences

`src/enhance/vocab.ts` is the sole source of truth for every reader word list. Host `vocabulary` lists replace only their documented defaults; the format-contract lists are fixed by the library. The format contract covers status roles and headers, ID and rule-ID grammars, technical, title and decision headers, file-path extensions, glossary headers and section names, merge subjects, date labels, colour-key labels, the editorial box and callout headings, and front-matter kind keys. It also fixes the `item:` line used by item links. A host supplies literal words, never patterns; the reader compiles them itself, with length and count limits.

The warm light and dark palette, self-hosted fonts and root-scoped CSS intentionally preserve the reference layout's visual direction. The intentional functional differences are: chrome never writes ids on source nodes; defined IDs deep-link through the reader index; Back is the host's `onHash`/`goToHash` round trip; a figure action adds no history entry; reading position is persisted through host storage; and the product lens is state on the root rather than a page-global setting. The reader deliberately has no routing, fetch, storage API or network behavior: `onLink`, `onHash`, `copy`, `changes`, `openVersion`, `itemLink` and `mermaid.load` are the exact host callbacks that provide those edges.

### Task 24 Audit Matrix

This is an implementation map, not final acceptance evidence. Task 23's dedicated diagram-tools coverage and the Task 24 browser, consumer, parity and whole-branch checks remain pending.

| Requirement | Frozen implementation pointer | Contract or test pointer |
|---|---|---|
| Root-scoped, import-inert lifecycle; ownership and journaled teardown | `src/enhance/lifecycle.ts`, `src/enhance/journal.ts` | `test/enhance-walls.test.ts`, `test/enhance-lifecycle.test.ts` |
| No network, URL, storage API, routing or performance marks | `src/enhance/host.ts`, `src/enhance/env.ts` | `test/enhance-walls.test.ts`; `test/enhance-scrub.test.ts` |
| Host callbacks and additive options | `src/enhance/types.ts`, `src/enhance/options.ts`, `src/enhance/host.ts` | `test/enhance-options.test.ts`, this API section |
| Namespaced prefs, UI, position and document state | `src/enhance/state.ts` | `test/enhance-state.test.ts`, Storage keys above |
| Several roots, root-local chrome and generated ids | `src/enhance/lifecycle.ts`, `src/enhance/registry.ts` | `test/enhance-seams.test.ts`, `test/enhance-walls.test.ts` |
| Word lists and format contract have one source | `src/enhance/vocab.ts` | `test/enhance-vocab.test.ts`, `test/enhance-scrub.test.ts` |
| Navigation, deep links and host-owned Back | `src/enhance/nav.ts`, `src/enhance/lifecycle.ts` | `test/enhance-nav.test.ts`, `test/enhance-jump.test.ts` |
| Reading position, read marks, rail state and seen state | `src/enhance/nav.ts`, `src/enhance/marks.ts`, `src/enhance/rail.ts`, `src/enhance/since.ts` | `test/enhance-scroll.test.ts`, `test/enhance-marks.test.ts`, `test/enhance-rail.test.ts`, `test/enhance-since.test.ts` |
| Changes and day-version controls stay host-fed | `src/enhance/changes.ts`, `src/enhance/since.ts` | `test/enhance-changes.test.ts`, `test/enhance-since.test.ts` |
| Drawings use a host module and preserve source fallback | `src/enhance/diagrams.ts` | `test/enhance-diagrams.test.ts`; Task 23 coverage pending |
| The standalone `./enhance` entry uses the default graph only; sibling-link rewrites and auto-bootstrap are absent | `src/enhance/index.ts`, `src/enhance/nav.ts` | `test/enhance-walls.test.ts`, `test/enhance-scrub.test.ts` |
| Hosted-font allowances and ready gates are not part of the library | `assets/reader.css`, `src/enhance/relayout.ts` | `test/enhance-styles.test.ts`, `test/enhance-relayout-baseline.test.ts` |

## Hosting on your own origin

A host that runs `./enhance` in its own page, rather than in the sealed frame, hands the reader adapters, never URLs: the library holds no URL of its own and never fetches. An older viewer's URL options each become an adapter. The recipes below map each one, with neutral `https://example.test/` URLs; each is a complete TypeScript module, typed by `EnhanceOptions` (the docs test typechecks every one under the strict settings).

```ts
// mermaidUrl → mermaid.load
import type { EnhanceOptions } from '@synapsium-labs/pinax-lib/enhance';

// The host serves the package's own assets/mermaid/mermaid.mjs from its origin; its start-on-load is off.
const mermaidUrl = 'https://example.test/static/pinax-lib/mermaid/mermaid.mjs';

export const options: EnhanceOptions = {
  mermaid: { load: () => import(mermaidUrl) },
};
```

```ts
// resolveLink → onLink
import type { EnhanceOptions } from '@synapsium-labs/pinax-lib/enhance';

declare function resolveLink(href: string): string | null; // the host's old resolver: a link as written, to its page
declare function goTo(url: string, newTab: boolean): void; // the host's own router

export const options: EnhanceOptions = {
  onLink: (href, how) => {
    const url = resolveLink(href);
    if (url !== null) goTo(url, how.newTab);
  },
};
```

```ts
// changesUrl → changes
import type { EnhanceOptions } from '@synapsium-labs/pinax-lib/enhance';

const changesUrl = 'https://example.test/api/changes';
const docPath = 'specs/example.md';

export const options: EnhanceOptions = {
  // The host's own endpoint answers { changed: [from, to][], removedAfter?: number[] } for the changes since `sha`.
  changes: async (sha) => {
    const r = await fetch(`${changesUrl}?path=${encodeURIComponent(docPath)}&since=${encodeURIComponent(sha)}`);
    return r.ok ? r.json() : null;
  },
};
```

```ts
// bar → chrome.bar
import type { EnhanceOptions } from '@synapsium-labs/pinax-lib/enhance';

// The host keeps its own bar above the document, so the reader builds none; its rail and settings menu stay.
export const options: EnhanceOptions = {
  chrome: { bar: false },
};
```

```ts
// issue-tracker base → itemLink
import type { EnhanceOptions } from '@synapsium-labs/pinax-lib/enhance';

const trackerBase = 'https://example.test/issues/';

export const options: EnhanceOptions = {
  vocabulary: { itemFields: ['Tracker'] }, // itemLink is called only for the keys these byline fields name
  itemLink: (key) => `${trackerBase}${encodeURIComponent(key)}`,
};
```

The same options, for a viewer that mounts the frame with `./host` instead, map to its `HostAdapters` (below): `onLink`, `changes`, `openVersion` and `mermaidDraw`.

| Old option | `./enhance` in the host's page | `./host`'s `HostAdapters` |
|---|---|---|
| `mermaidUrl` | `mermaid.load()` | `assets.mermaid`, the text of `assets/mermaid/mermaid.frame.js`, or `loadMermaid`, and `mermaidDraw` (`'auto'`, `'on-request'` or `'after-ready'`) |
| `resolveLink` | `onLink(href, how)` | `onLink(link)`, with the link already classified (a `HostLink`: `fragment`, `relative` or `external`) |
| `changesUrl` | `changes(sha)` | `changes(sha)`, answering `{ ranges, removedAfter? }` or `null` |
| `bar` | `chrome.bar` | `features.chrome.bar` |
| issue-tracker base | `itemLink(key)` | none: `itemLink` answers at once and cannot cross the bridge |
| version pages | `openVersion({ sha, only })` | `openVersion({ sha?, only? })` |

**Mermaid in the host's page.** The module `load()` resolves with (its default export, or the module itself) must offer `initialize` and `render`, the two calls the reader makes; one without them leaves every figure to its source, with a note. Serve the package's own `assets/mermaid/mermaid.mjs`, and never load a stock Mermaid with its start-on-load on: stock Mermaid draws every `.mermaid` element of the page when the window loads, with its own defaults and into the document's own nodes; the package's own Mermaid files have it off. The reader names each drawing it asks Mermaid for with a counter that is per copy of the library, so a page that bundles `./enhance` twice (two builds of the host's code, say) can issue the same drawing name twice, and the two drawings then take each other's ids: load one copy of `./enhance` per page. The frame holds one copy, so it cannot.

## Framing: `./frame`

`./frame` builds the sealed reader frame's document as one string, for an `<iframe sandbox="allow-scripts" srcdoc>`. It is pure: no DOM, no clock, no randomness, no I/O, and it fetches nothing. The host reads the asset files and passes their texts; `frameDocument` checks each against the manifest it was built with.

```ts
import { frameCsp, frameDocument, FrameError, mermaidGate } from '@synapsium-labs/pinax-lib/frame';
import { render, scanRefs } from '@synapsium-labs/pinax-lib/render';

const result = render(markdown);
const scan = scanRefs(markdown);
const gate = mermaidGate(scan.mermaid); // in UTF-16 code units; caps may only tighten
try {
  const srcdoc = frameDocument(
    { result, scan },
    {
      csp: frameCsp(),
      nonce, // 32 lower-case hex digits, fresh for every mount: 16 bytes of crypto.getRandomValues
      assets, // { guard, bootstrap, enhance, css, mermaid }: the texts of the files below, read by the host
      mermaid: gate.inline ? { maxTextSize: gate.maxTextSize } : null,
    },
  );
  showInSandboxedFrame(srcdoc, frameCsp());
} catch (e) {
  if (e instanceof FrameError) showPlainView(e.code); // never a partly working frame
  else throw e;
}
```

**The srcdoc.** One line, with no whitespace or comment between elements, that starts literally with the CSP meta: `<meta http-equiv="Content-Security-Policy" content="…">`, then the click guard (`frame/guard.js`), the seed (`<script type="application/json">`, the document and the frame's settings as escaped JSON), the bootstrap (`frame/bootstrap.js`), the style (`frame/reader.css`, the package's fonts inlined as `data:` URLs), `enhance.js` (`frame/enhance.js`, the layout) and, only when `mermaid` is not `null` and its draw mode is not `'after-ready'`, `mermaid.frame.js` (`mermaid/mermaid.frame.js`). Every script and style body is the asset's exact text. There is no doctype and no html, head or body tag: everything lands in the implied head, and a srcdoc document is never in quirks mode. The rendered html travels only as escaped text in the seed: no `<`, `>`, `&`, U+2028 or U+2029 appears there raw, so it cannot end its element. The bootstrap reads the seed as the element just before its own script (never by id), and at DOMContentLoaded parses the html once, inertly, checks it against `render()`'s closed vocabulary (refusing the whole document over any element or attribute outside it), and runs the layout on it. Nothing in the srcdoc loads a URL: no `src`, `href`, `<link>`, `<base>` or `@import`, and the only `url(` is a font's `data:` URL.

**The policy.** `frameCsp()` is the canonical frame policy: `default-src 'none'`, a `script-src` of the four scripts' hashes (Mermaid's included whether or not a document inlines it, so a host's policy is one constant per version), `style-src 'unsafe-inline' data:`, `font-src data:`, `img-src data:`, `base-uri 'none'` and `form-action 'none'`. Set it on the iframe's `csp` attribute as well where the engine has one. `checkFrameCsp(csp, requiredHashes)` answers `{ ok: true }` or `{ ok: false, why }`, `why` one of `CSP_REFUSALS`: a policy is accepted only when it is no wider than this one and holds every required hash. `FRAME_MANIFEST` lists the frame assets (the five of the default layout, then each other layout's bundle and stylesheet) with their paths, sha256, bytes, UTF-16 lengths, hash sources and `layout`; `assets/assets.json` lists every file under `assets/` with its sha256, bytes and kind, a script's hash source and, on every layout asset, its `layout`. Every hash move is a minor release: re-pin the policy then.

**Layouts.** A frame carries one layout, one of `FRAME_LAYOUTS` (`'default'`, `'classic'`, `'editorial'`, `'review'`, `'guided'`; `isFrameLayout(v)` tells a name from anything else). `default` is the reader described everywhere else in this file; each other layout is its own enhance bundle over the same shared modules (`frame/enhance-<name>.js`) and its own stylesheet (`frame/layout-<name>.css`). `frameDocument`'s `layout` option names it (default `'default'`; a name that is not a layout is `invalid-input`); `assets.enhance` is then that layout's bundle, verified against that layout's manifest entry, and `assets.layoutCss` is its stylesheet: required when the layout has one (`missing-asset` without it), and refused with `asset-mismatch` for `default`, which has none, or for any text that is not the layout's own. The stylesheet sits in the same `<style>` element as `frame/reader.css`, after it and one newline, so the elements and their order are exactly the default's; a layout marks its root with `data-docreader-layout` and scopes every rule of its stylesheet under that mark. `frameCsp(layout)` is the policy of that layout's frame: the guard's, the bootstrap's, that layout's enhance bundle's and Mermaid's hash sources, in that order, and no other layout's; `frameCsp()` is `frameCsp('default')`, and a name that is not a layout is a `TypeError`. `checkFrameCsp` accepts any hash this version ships, every layout's included, so a policy stored for one layout stays valid, and `missing-hash` still refuses a policy without the chosen layout's. `maxSrcdocChars(layout)` is the longest srcdoc that layout's frame writes (derived from the entries that frame inlines), and `MAX_SRCDOC_CHARS_DEFAULT` is `maxSrcdocChars('default')`; the `maxSrcdocChars` option may only lower the chosen layout's cap. `./host`'s `layout` adapter takes the same name.

`classic` keeps the summary and status boxes, numbered headings, a Contents sidebar and phone drawer, section chips on phones, table filters, quick jump and figure tools without the default layout's review strip, Index tab or settings menu. A valid feature flag for chrome a layout doesn't draw is harmless. For example, setting `features.inShort` in `classic` keeps the whole summary visible without drawing the Headlines / Full switch.

`editorial` adds the title block, linked standing counts, plan labels without outline controls, and a running head. Its sidebar and phone drawer show Contents only; it has neither section chips nor an Index tab. Quick jump still reaches configured rules, eligible rows and captioned figures. Unlike `classic`, it offers the Headlines / Full switch when `features.inShort` is enabled. Alternate layouts are selected in the sealed frame, not in the standalone `./enhance` entry.

`review` is the review workbench. A header card holds the title block, its status and what waits on the reader, with a progress row (how many sections are read or changed since they were read) and a button, and the key `n`, to the next unread one. The rail keeps the shared Contents and Index tabs, with a link to the "Waiting on you" box and the count of sections read. A mark in the bar's tray marks the section being read, ID links preview their row, and tables with long rows are clipped to a few lines with a button per row and an "Open all rows" tool (whole in print, and not clipped on a phone, where rows stack). It leaves out the section folds, the changes-since menu and change stepper, term links, the Product and Engineering lens and the reading settings menu. It keeps no state of its own: its read marks, Index fold and tab are the shared reader's existing fields.

`guided` reads in layers. A hero holds the title block, the properties and "In short", with a glance under it: how long "In short" and the whole document take, what the document holds and what waits. Each level-2 section shows its heading, its reading time and its opening intro, and folds the rest behind one button (hidden `until-found`, so a link, a quick-jump hit or the browser's find opens the fold it lands in; print shows everything). Expand all, Collapse all and the Product and Engineering lens sit in the bar, and each Contents link carries its section's reading time. Terms are defined on hover, focus or tap, and a table is a set of cards on a phone. It leaves out the Index tab, ID links and previews, the review strip, read marks, the change stepper, the settings menu and the keys sheet; the reference's sub-folds, terms in the quick jump and its `?lens=` address are not ported. **Folds are shared.** `guided` keeps its folded sections in the same per-document `folds` field the default layout uses (the host's bootstrap has no room for a field of its own, ccrc D-8881), and its choice of layers in the reader's UI memory. So a section folded in one of the two layouts shows folded in the other for the same document, if the other has a fold for it; each layout ignores an entry it has no section for, a value that is not a list and anything that is not a string, and never rewrites what it only read. The default layout's own fold writes only the sections it has a fold for.

**Refusals.** `frameDocument` throws a `FrameError` whose `code` says why; a host shows its own view of the document instead.

| Code | When |
|---|---|
| `not-rendered` | The document did not render: `result.outcome` is `'over-limit'`, `'output-over-limit'` or `'failed'`. |
| `invalid-input` | A value outside its grammar or cap: lang, an image ref or data URL, a store key or value, a commit sha, prefs, features, `mermaid.draw`, Mermaid's `maxTextSize` over 50000 or `maxEdges` over 500 (`MERMAID_LIMIT_CEILINGS`), a `maxSrcdocChars` over its default. An `initialHash` outside the fragment grammar is not refused: it is seeded as `null`. |
| `nonce` | The nonce is not 32 lower-case hex digits. |
| `asset-mismatch` | An asset is not a string, or its sha256 is not the manifest's. |
| `unsafe-asset` | An asset breaks the byte rules: a script holding `<script`, `</script`, NUL, CR or a BOM, a stylesheet holding `</style`, `@import` or a `url(` that is not a font's `data:` URL. Checked before the hash, so a planted CR reads `unsafe-asset`. |
| `csp` | The policy fails `checkFrameCsp`, or lacks the hash of a script it is about to inline. |
| `missing-asset` | `mermaid` is not `null` and `assets.mermaid` is absent, except in `'after-ready'`, which needs no Mermaid asset (the policy must still list Mermaid's hash). |
| `too-large` | The html, as the seed carries it, is over `SEED_HTML_MAX_CHARS`, or the whole srcdoc is over `maxSrcdocChars`. |

**Caps.** `SEED_HTML_MAX_CHARS`, 57265090, bounds the html as the seed carries it (escaped), in UTF-16 code units: the spec's 2 MiB document cap times the largest ratio of escaped html to markdown bytes over the golden corpus (27.3061, on `nesting-limit.md`), so no legal document is refused. `MAX_SRCDOC_CHARS_DEFAULT` adds to it the five assets' lengths, the 5 MiB image budget in base64, the seed's other fields at their caps and the skeleton (116 224 259 characters at this version, about 116.2 million; it moves with every asset). `maxSrcdocChars` may only lower it: a host that measures its own documents sets it lower. `maxSrcdocChars(layout)` is the same cap for another layout's frame (its own bundle and stylesheet counted in place of the default's). Images reach the frame only as `data:` URLs in `images` (at most 512, refs of at most 2048 code units), keyed by the `src` exactly as `scanRefs()` lists it.

**Mermaid.** `mermaidGate(counts, caps?)` decides whether Mermaid is on for a document (in `'auto'` and `'on-request'` it then inlines `mermaid.frame.js`; in `'after-ready'` it decides whether the host hands the build over, and nothing is inlined), from `scanRefs().mermaid`'s code-unit counts: Mermaid comes in for a document with at least one fence and at most `MERMAID_GATE_DEFAULTS`' 24 fences and 131072 code units in all, and the per-fence cap (16384) travels as `maxTextSize`, so only a longer fence shows as its source. Caps above the defaults are a RangeError: caps only tighten. With `mermaid: null` every figure shows its source. `mermaid.draw` is `'auto'` (the default: every figure is drawn before the frame says it is ready), `'on-request'` (a figure is drawn only when a reader taps its Render button, so nothing draws before ready) or `'after-ready'` (the frame is ready without Mermaid, no `mermaid.frame.js` is inlined and `assets.mermaid` is not needed, but the policy must still list its hash; the host sends the build over the bridge after ready, and every figure stays readable source until it arrives, and for good if it never does).

**The appearance and the faces.** `frameDocument`'s `appearance` option takes any value through `parseAppearance` and seeds its verdict, so a bad slot never throws (a value that is not a plain object reads as `{mode: 'auto'}`); the frame is then hosted for its whole life. `assets.fonts` is `{sans?, mono?}`, base64 woff2 for the frame's sans and mono roles: a `fonts` that is not a plain object, a key other than `sans` and `mono`, a getter or a face that is not a string throws a `TypeError`, and a face outside the base64 alphabet, without the `wOF2` signature or over 131072 decoded bytes (174764 characters of base64) is dropped silently, so that role keeps the library's own face. A mount with neither writes the same srcdoc as 1.1.0, and neither changes the policy. `MAX_SRCDOC_CHARS_DEFAULT` counts both seed fields at their caps (two faces of 174764 characters, and the longest seed text a value `parseAppearance` accepts), so neither pushes a document into `too-large`.

**Item links.** `frameDocument`'s `items` option takes the resolved item links, at most 50 `{ value, href }` objects: `value` 1 to 100 code units (a value of `meta.items`), `href` an absolute `https:` URL of at most 4096 code units (no user information, white space, control character, backslash, raw or percent-encoded (`%5c` in any case, as `onLink` refuses it), or any hidden character the `copy` row lists, which are the ones `onLink` refuses; the frame and `onLink` refuse the same hidden characters, white space and backslash escapes in the host part, path, query and fragment alike, and a test holds them equal there; the host part's own grammar is otherwise the host's alone, so a host the URL parser refuses, such as a bad percent escape, is drawn by the frame and its click is still dropped by `onLink`, and two such differences are known and pinned by that test: a lone surrogate in the host part (the frame admits it, the URL parser refuses it) and `%255c` in the host part (the frame admits it; the host decodes the `%25` and refuses it), where in the path, query and fragment both admit each). Anything else is `invalid-input`, naming the entry and its field and never repeating it. The seed carries them in an optional `items` key (none for an absent or empty list, so a host that gives none gets the seed it always got), counted in `MAX_SRCDOC_CHARS_DEFAULT` at its cap. The frame's own seed check holds the outer shape only (to keep the bootstrap in its budget); the reader judges the href again before it draws a link, so an `href` that is not an absolute `https:` URL is never drawn and its value stays text. The reader asks `itemLink(value)` and the frame answers the seeded href for the exact value, else nothing, so an unseeded item stays text; a click goes the way every link goes (`navigate`, and the host decides).

**Vocabulary.** `frameDocument`'s `features.vocabulary` is judged in full on the host side, before the seed is written: a key the vocabulary does not have, a list of more than 200 words, a word that is empty, of more than 64 code units or with white space at either end, or an `ids` that is not `false` or `{ prefixes }` is `invalid-input` naming `features.vocabulary`. The frame's own seed check holds the field to a plain object only (to keep the bootstrap in its budget); the reader's option check judges the words again when the frame runs the layout, so a seed whose vocabulary was changed after `frameDocument` fails the render, and the host falls back as for any failed render.

**The In short switch and the comparison base.** `frameDocument`'s `features.inShort` (a boolean, default `false`) turns on the "Headlines / Full" switch of the "In short" box (the reader's `inShort` option; the choice goes out as `store.set` of `pref:ui`). Its `changesBase` option takes the comparison base, a full sha (40 or 64 lower-case hex digits; anything else is `invalid-input`), as an optional seed key, `changesBase`, absent unless the host gave one: the host records the commit when the frame asks it, through `changes`, for what changed since, and seeds it back at the next mount. With the bridge's `changes` on, the reader asks `changes` for that commit once, after `ready`, and shows the comparison as "Changes since" shows one, labelled by the base's commit when the seed's `commits` name it, else "Since your comparison". The host's `changesBase` adapter (a string; not a string is a `TypeError`, a string that is not a full sha is logged once and not seeded) is the same value. Record a base only for a comparison the reader chose (the "Changes since" menu): the frame also sends `changes` for the automatic "since your last visit" measure and for a one-day version, and a base recorded from those is not a comparison the reader picked.

**Bridge switches.** `frameDocument`'s `bridge` option says which ops the parent answers: `links`, `hash`, `copy`, `changes`, `versions`, `progress`, `places` and `printFigures`, each a boolean, and an unknown key is `invalid-input`. A switch left out is `true`, except `progress`, `places` and `printFigures`, which are `false`: the frame sends `progress`, `place` and `print-figure` (and the `push` and `from` of `hash`, with `places`) only to a parent that asked for them, so a host that never heard of the ops is never sent one. A `false` leaves that reader callback absent, so the reader builds no control whose op nobody answers.

`./frame` also exports the bridge's protocol (`BRIDGE_PROTOCOL`, `SEED_SCHEMA`, `BRIDGE_LIMITS`, `OP_KEYS`, `FRAME_ACCEPTS`, `ERROR_WHY`, `PREF_KEYS`, `DOC_FIELDS`, `FRAGMENT_ID_GRAMMAR`, `isFragmentId()`, `PLACE_KINDS`, `ANCHOR_LIMITS`, `isAnchorToken()` and `pngBytesOfBase64()`; see the bridge, below) and its types: `RenderInput`, `FrameOptions`, `FrameAssets`, `FrameFeatures`, `FramePrefs`, `FrameErrorCode`, `BridgeStoreKey`, `ErrorWhy`, `FrameToParent`, `ParentToFrame` and `CspRefusal`. Its declarations name no DOM type, so a worker or a server builds a srcdoc with no DOM library.

### The appearance contract

`./frame` also carries the contract by which a host hands the frame its own look: a `mode`, 33 base colours, ten skin values and a one-line label. It is pure data and one validator, so a host and the frame judge a value by the same code. The first consumer's design, whose section 2 fixes the grammars, is [Native Docs reader: appearance continuity](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-11-18-native-docs-appearance-continuity-design.md).

- `APPEARANCE_CONTRACT` is `1`, the contract's version. It is absent in 1.1.0, which is how a host detects support.
- `APPEARANCE_SLOTS` lists the closed slot names by group, in order: `colour` (33 names, from `bg` to `syn-inserted`) and `skin` (`radius`, `radiusSmall`, `radiusLarge`, `controlRow`, `popShadow`, `sectionFamily`, `sectionSize`, `sectionWeight`, `sectionTracking`, `sectionCase`). Its types are `Appearance` (`{mode: 'light' | 'dark' | 'auto', colour?, skin?, label?}`), `AppearanceColourSlot` and `AppearanceSkinSlot`. It and `APPEARANCE_PAIRS` are deeply frozen.
- `parseAppearance(x)` never throws, for any value (a cycle, a BigInt, a getter, a Proxy, a revoked Proxy). It returns `{appearance, refused}`: `appearance` is always usable, and `refused` lists an `AppearanceRefusal`, `{key, why}`, for what it left out. Every value is a string matched against one anchored pattern after its outer U+0020 spaces, which the verdict drops: a colour is `#rrggbb`, and the skin slots are whole pixel lengths, a one-to-three-shadow `popShadow`, and the section label's family, size, weight, tracking and case. The colour group is all or nothing, a refused skin slot or label drops alone, and a bad `mode` reads as `auto`. It reads own data properties only and never calls an accessor; a group of over 64 own keys (symbol keys count, and are never read), or a value that counts over 8 192 UTF-16 code units, is refused whole.
- **The refusal `key`** is `mode` or `label` for those two keys, `colour` or `skin` for a whole group, `colour.<slot>` or `skin.<slot>` for one value (an unknown key is named the same way, `colour.<key>`; at the top level it is named by itself), `(symbol)` for a symbol key, and `*` for the whole value. The **`why`** (`AppearanceRefusalWhy`) is one of `unknown-key` (a key the contract does not have: refused alone, and a colour group whose 33 slots are all valid stands), `type` (not a string, not a plain object, or an accessor), `grammar` (the value fails its pattern), `range` (the pattern admits it and the range does not), `incomplete` (a colour group missing a slot), `too-many-keys`, `too-large`, `unreadable` (a Proxy trap threw) and `label` (the label is empty, over 64 code units, or holds a refused character). A group's own `incomplete` entry comes first among that group's entries.
- `APPEARANCE_LABEL_DEFAULT`, "Appearance follows the app's settings", is the line shown when there is no label, or a refused one. A label is 1 to 64 UTF-16 code units, free of control, format, line and paragraph separator characters and lone surrogates, and is text only.
- `APPEARANCE_PAIRS` lists every `{fg, bg, floor}` pair of colours the stylesheet puts in front of one another while hosted, derived tints included, with the contrast floor to hold (4.5, and 3 for the focus ring). A host that maps its own palette checks every pair.
- `MERMAID_HOSTED_KINDS` names the eight Mermaid diagram kinds drawn in the host's colours while hosted, by the id the bundled Mermaid's own `parse` answers: `flowchart-v2`, `sequence`, `classDiagram`, `stateDiagram`, `gantt`, `pie`, `er` and `gitGraph`. Every other kind, and a figure its author styled, keeps 1.1.0's drawing, plate and filter. It is frozen.
- `mermaidThemeOf(colours)` is the pure derivation of Mermaid `themeVariables` from the 33 colour slots: every colour key the bundled `base` theme reads for those kinds, the pie and git series, `fontSize` `14px`, `pieOpacity` `1` and `dropShadow` `none`. Tints are resolved to `#rrggbb`.

## Hosting: `./host`

`mountDocFrame(el, { document, adapters })` is the reference parent of the frame, for viewers that do not speak the bridge themselves. It mounts the frame into `el`, speaks the bridge with it, and hands every effect to the host's adapters. Importing `./host` touches no DOM, starts no timer and keeps no state; only a mount does.

```ts
import { mountDocFrame } from '@synapsium-labs/pinax-lib/host';

const frame = mountDocFrame(container, {
  document: { result, scan }, // render() and scanRefs() of the document
  adapters: {
    assets, // the texts of the frame files, read by the host
    watchdogMs: 20_000,
    store: localStorage,
    docKey: 'specs/example.md',
    onLink: (link) => routeTo(link),
    onFallback: (reason) => showPlainView(reason),
  },
});
frame.setPrefs({ theme: 'dark' });
frame.update(next); // a full remount for another document or version
frame.destroy();
```

A mount checks the adapters (own data properties only; an unknown key or a bad value throws a `TypeError` or `RangeError` before any iframe exists), runs the Mermaid gate, makes a fresh 128-bit nonce, builds the srcdoc under `frameCsp()`, and creates a new iframe with `sandbox` exactly `allow-scripts`, `referrerpolicy="no-referrer"`, the `csp` attribute and its `title`, all before insertion, inserts it and focuses it (unless `focus` is `false`). Its first load gets one `hello` with one port, and the watchdog runs from insertion to a valid `ready`. A refusal by `frameDocument` calls `onFallback` once and creates no iframe. `./host` never navigates, never opens a window, never touches the clipboard and adds no window `message` listener: links, hashes, copies, versions and changes reach the host only through its adapters, and an adapter that throws is caught and logged, never counted against the frame.

| Adapter | Meaning |
|---|---|
| `assets` | Required: the exact texts of `frame/guard.js`, `frame/bootstrap.js`, `frame/reader.css` and `mermaid/mermaid.frame.js` (the last one not needed in `'after-ready'` mode when `loadMermaid` is given). Set `enhance` to `frame/enhance.js` for `default`, or to `frame/enhance-<name>.js` for the chosen alternate, and set `layoutCss` to that alternate's `frame/layout-<name>.css` (`default` must omit `layoutCss`). Optionally `fonts`, `{ sans?, mono? }`, base64 woff2 for the frame's sans and mono roles. A face that fails the checks (base64 alphabet, `wOF2` signature, 131072 decoded bytes) is dropped silently and the mount continues; a `fonts` that is not a plain object, has another key, has a getter (on `fonts` or on a face) or holds a face that is not a string throws a `TypeError`, never a fallback, whatever the kind of object `assets` is: at mount time, or at `update()` for a `fonts` added after a mount that had none. `fonts` is read and checked at `mountDocFrame` when you give it then (once, so changing `assets.fonts` afterwards changes no later `update()`); when you gave none, `update()` reads it from your live `assets` object again, checked the same way, so a malformed `fonts` you have added since is a `TypeError` thrown by `update()` before anything is torn down (the current mount stays as it is, no fallback) and a good one is seeded. Every other asset is read from your `assets` object at each mount, as in 1.1.0 (inherited properties and a later `assets.mermaid` included). Fonts and an appearance change neither the srcdoc's policy nor the iframe's `csp` attribute. |
| `layout` | `HostAdapters.layout`: the layout the frame carries, one of `FRAME_LAYOUTS` (default `'default'`), handed to `frameDocument` and to `frameCsp(layout)`. Give `assets.enhance` as that layout's bundle and `assets.layoutCss` as its stylesheet. A host that names none gets the default layout's srcdoc and policy exactly. A value that is not a layout name (`null` and the empty string included) throws a `TypeError` at mount, before any iframe exists; a layout whose assets are not its own is the `'assets'` fallback. |
| `watchdogMs` | Required: from insertion to a valid ready, an integer from 1 to 120000 ms. In `'auto'` mode ready waits for Mermaid's first full pass, so allow for it. |
| `store`, `storePrefix`, `docKey` | The host's Web Storage (`getItem`, `setItem`, `removeItem`, `key`, `length`), the prefix of every key it writes (default `'docreader:'`), and this document's identity (absent: no per-document state). The store builds every key itself: `<prefix>pref:<name>` and `<prefix>doc:<docKey>:<field>`. A value is JSON of at most 64 KiB, everything under the prefix stays within 1 MiB, and past it the least recently written documents' keys are evicted, inside the prefix only. |
| `prefs`, `features` | Starting prefs (`theme`, `width`, `font`) and the layout's switches and word lists (`rules`, `folds`, `keyboard`, `inShort`, `chrome`, `vocabulary`), as plain data. |
| `mermaidGate`, `mermaidDraw` | Tighter gate caps, and `'auto'` (default), `'on-request'` or `'after-ready'`. |
| `loadMermaid` | `loadMermaid()`: a promise of the exact text of `mermaid/mermaid.frame.js`; used only with `mermaidDraw: 'after-ready'` (in any other mode it is ignored, whatever it holds, and never called; in `'after-ready'` it must be a function when given, and when `assets.mermaid` is given too, the loader is used). In that mode the frame is mounted and made ready without Mermaid, and the host's duty is to hand the build over: with neither `loadMermaid` nor `assets.mermaid`, the mount throws a `TypeError`, and a host whose build never arrives leaves every figure as its source. The mount calls it at most once per `DocFrame`, in parallel with the frame's boot, and only for a document the Mermaid gate lets in (a document with no fences never calls it); a later `update()` reuses the held answer. The text is checked before it is sent: a string of at most 8388608 UTF-16 code units whose sha256 is the shipped build's. A throw, a rejection, a value that is not a string, an oversize or a different text gives one console warning and tells the frame the build is unavailable, so the figures stay as source; nothing the loader does throws out of `mountDocFrame`, `update()` or the port. The text is posted once per mount, after that mount's own valid ready. |
| `appearance` | The host's look, the contract of [The appearance contract](#the-appearance-contract): any plain object, taken through `parseAppearance`, whose verdict every mount seeds (a bad slot never throws; the frame is hosted for its whole life). A value that is not a plain object throws a `TypeError` before any iframe exists. |
| `items` | `items(values)`: resolves the item values a document names into links, synchronously, in the host's own code. Called at each mount with the values of the document's `meta.items` (a frozen list of at most 50, each 1 to 100 code units; not called when there are none), as a method of the adapters object. It answers at most 50 `{ value, href }`, `href` an absolute `https:` URL (see "Item links"); a throw is logged and means no links, an answer of `undefined` or an empty list likewise, and so is an answer that is not a list of such links (one warning naming the entry and field, never the value): no `items` are seeded, the items stay text and the document still mounts. `frameDocument` itself refuses such an `items` as `invalid-input`. The library carries no tracker: the host knows its own. |
| `changesBase` | The comparison base: a full sha (40 or 64 lower-case hex digits), seeded into every mount as the seed's `changesBase`, so the frame asks `changes` for it once after ready and shows the comparison (needs the `changes` callback; the host records the commit when `changes` is asked for it, but only for a comparison the reader chose from the "Changes since" menu, not for the automatic "since your last visit" measure or a one-day version, which are asked through `changes` too). A value that is not a string throws `TypeError`; a string that is not a full sha is logged once and not seeded. |
| `title`, `focus` | The iframe's accessible name (default `'Document'`), and whether to focus it on mount (default `true`). |
| `onLink` | A link the reader followed, already classified: a `fragment`, a `relative` path (query dropped) or an `external` http, https or mailto URL. `javascript:`, `data:`, protocol-relative links, backslashes, controls, white space (U+2028 and U+2029 among it) and every hidden character the `copy` row lists are refused before it. |
| `onHash` | `onHash(id)`: the reader went to this fragment id. With `onPlace` given, `onHash(id, { push, from })`: `push` is true when the move is a new place in the host's history, `from` is the opaque position token of the place being left (or `null`), to hand back to `goto(id, from)`. A host without `onPlace` is called with the id alone, as in 1.1. |
| `onPlace` | `onPlace(kind)`: the frame's full-screen figure opened (`'overlay'`) or closed (`'overlay-closed'`). Giving it is what asks the frame for places (the seed's `bridge.places`), and nothing else does: it also makes `onHash` carry its second argument, and is what `closeOverlay()` and `goto()` need. A frame that sends a `place`, or a `hash` with `push` or `from`, to a host without it is refused and counted. |
| `onPrintFigure` | `onPrintFigure({ i, n, png })`: one figure of a print run, `i` of `n` (numbers, `0 <= i < n <= 64`), `png` the canonical base64 text of a PNG, as sent: it starts with the base64 of the PNG signature (`iVBORw0KGgo`), at most 1048576 bytes decoded (`printFigurePngMaxBytes`); the 16 MiB, 16777216 bytes, is `printFiguresTotalMaxBytes`. Bounds per run: the latest copy of each index is at most 16 MiB in all; a run hands on at most 2n figures (each index at most twice) and at most 2 x 16 MiB in all, replaced copies counted. A figure past either cap is refused before decode and counted. `./host` checks the signature, the text and the sizes from the text alone and never decodes: the host decodes. Giving it is what asks the frame for print figures (the seed's `bridge.printFigures`), and a run opens only through `printFigures()`. After a `printFigures()` that interrupts an unfinished run an index can come twice (a figure already posted for the earlier run, then the new run's own): the latest copy of an index wins, so keep figures by index and let a later call replace an earlier one. |
| `copy` | `copy(text, { hidden })`: the text to copy and every character in it a reader cannot see (controls, bidi controls, directional marks, the line and paragraph separators U+2028 and U+2029, zero-width characters, tag characters), each with its index, code point and name, so the host can show them before writing. |
| `changes` | `changes(sha)`: a promise of `{ ranges, removedAfter? }` or `null`; a throw, a rejection, a malformed answer or 30 s without one answers the frame "unavailable". |
| `openVersion` | `openVersion({ sha?, only? })`: show that version; no keys is the latest. |
| `onProgress` | `onProgress(share)`: how far the document has been read, a number from 0 to 1 (the frame's thousandths over 1000). The frame sends at most four reports a second: the first value at once, then the latest of each 250 ms window when it ends, so the final value always arrives; `./host` trusts the frame's pacer and does not throttle further (the bridge's general limits still bind a frame that does not keep it). Giving it is what asks the frame to send progress: a host with no `onProgress` is sent none. A throw is caught and logged, never counted against the frame. |
| `onReady` | The frame said ready. |
| `onFallback` | Required: the frame is gone, for one reason: `'timeout'`, `'nonce'`, `'error'`, `'protocol'`, `'refusals'`, `'navigated'`, `'assets'`, `'too-large'` or `'invalid-input'`. Called once per mount; the mount never remounts by itself. The frame's own error reason never reaches it. |

Without `copy`, `changes` or `openVersion` the reader builds no control for that action, and without `onLink` a link to another page does nothing: the frame never navigates itself. `update(document)` is a full remount (a new iframe, channel, nonce and watchdog), also after a fallback; `setPrefs(prefs)` is posted once ready and seeds every later mount; `destroy()` is idempotent and calls no adapter, and after it `update`, `setPrefs` and `setAppearance` do nothing.

**`setAppearance(appearance)`** hands the open frame a new appearance. A value that is not a plain object throws a `TypeError`, whatever the state; any plain object is taken through `parseAppearance`, and its verdict (never the raw value) is what travels. Before the frame's valid ready the verdict is queued, the latest wins, and it is posted once after ready, next to any queued prefs; after ready it posts exactly one `{ t: 'appearance', v: 1, appearance }`. The latest verdict, from the adapters or from this call, seeds every later `update()` mount. After a fallback it posts nothing, and its verdict seeds a later `update()`; after `destroy()` it does nothing; for a plain object it never throws. A `setAppearance` or `setPrefs` made inside `onReady` is posted after the values queued before ready, so it wins. The frame sends nothing back.

**`command(name)`** runs one of the reader's tools for a host that draws its own bar: `'jump'` (the quick jump), `'settings'` (the reading settings), `'contents'` (the contents drawer) or `'outline'` (a plan's Outline), the names `runEnhancementCommand` takes, each a toggle. It focuses the iframe, then posts the command, so the keys the tool uses reach the frame. Before the frame is ready, after a fallback and after `destroy()` it does nothing and is not queued; a name outside the four throws a `TypeError`, whatever the state. The frame answers nothing: a tool that is turned off, a document without that tool or another overlay that is open make a command that changes nothing. Call it from the click handler of the host's own button, so a second press closes what the first opened. While the reading settings menu is open, the focus leaving the frame (a press on the host's own button, or Tab) does not close it, and a command for another tool (`'contents'`, `'jump'`, `'outline'`) answers nothing and changes nothing until the menu is closed: press the settings button again, press Escape in the frame, or press inside the frame.

**`closeOverlay()`, `goto(id, from?)` and `printFigures()`** are the commands that are not tools. Each posts its command once the frame is ready and does nothing before it (it is not queued), after a fallback and after `destroy()`; none moves the focus. `closeOverlay()` closes the full-screen figure if it is open, and needs `onPlace`. `goto(id, from?)` takes the reader to the place `id` (the fragment grammar of `hash`, at most 256 code units), from the position token `from` an `onHash` entry gave (`isAnchorToken()` judges it): an `id` outside the grammar or a `from` that is not a token throws a `TypeError` whatever the state, and so does a host with no `onPlace`; the frame answers nothing, and a place that is not in the document changes nothing. `printFigures()` opens one print run and asks the frame to draw its figures; they come back one at a time through `onPrintFigure` and it needs that adapter (else a `TypeError`, whatever the state). A run belongs to its call: the parser refuses a figure with no open run (the frame cannot open one), an `n` that changes within the run, an `i` seen already or at or above `n`, a text that is empty, longer than a 1 MiB figure can have or not canonical base64, a figure over its cap or one that takes the run over its total, and each refusal counts toward the sixteen that close the frame; a refused figure never reaches `onPrintFigure`. The run does not end at its last index: it ends at the next `printFigures()` call and when the mount goes, so a figure of a run the reader cancelled, still in the port's queue, lands in the new run under its own index. A run opened while the previous one was unfinished (itself reopened, or fewer than `n` distinct indexes accepted, or none) is reopened, and once a mount's run was reopened every later run is; a run after a complete ordinary run is ordinary: in it the first repeat of an index replaces the earlier copy, is handed to `onPrintFigure` again (the latest copy of an index wins) and counts no refusal, with the run's total adjusted by the copy it replaces before the 16 MiB check; a second repeat is refused as any repeat is in another run. The known limits of a reprint, in plain words:

- (a) If the new run skips an index (a figure it could not draw), the earlier copy of that index stays, in the earlier colours if the appearance changed in between.
- (b) A reprint can cost refusals in two cases only, and refusals never decay on a mount:
  1. **The oversize edge.** Near the 16 MiB total, stale copies still counted can make a new copy refused as oversize, and counted, the consumer keeping that index's earlier copy. Two triggers: stale copies larger than their replacements (drawn before an appearance change, say), and stale copies of indexes the new run never replaces (a figure it could not draw, or one it skipped at its own 16 MiB total). Several can be refused this way, and in an extreme skew enough to close the frame.
  2. **Three runs' figures in flight at once** (two presses before the host has drained its port). One cause, two effects: a third copy of one index is refused and counted (the copy refused is the run's own, so the consumer keeps a stale copy of that index); and, with figure sizes that change between those runs, an honest copy can be refused by the 2 x 16 MiB cap on what a run hands on. Sixteen such third-copy refusals close the frame, as any sixteen refusals do.
- (c) Bounds per run: the latest copy of each index is at most 16 MiB in all; a run hands on at most 2n figures (each index at most twice) and at most 2 x 16 MiB in all, replaced copies counted. A figure past either cap is refused before decode and counted.

`command(name)` runs only the four tools: another word, `'goto'`, `'close-overlay'` and `'print-figures'` included, is a `TypeError`.

**One header bar.** A host that draws its own bar above the frame turns the reader's bar off, keeps the title and the reading line itself, and reaches the tools through `command`. The title is the document's first level-1 heading, already in `result.meta.title` (the same text the frame shows, byte for byte; no op carries it), so the host reads it there and falls back to its own name:

```ts
const frame = mountDocFrame(container, {
  document: { result, scan },
  adapters: {
    assets,
    watchdogMs: 20_000,
    features: { chrome: { bar: false, topSpace: false } },
    onProgress: (share) => progressLine.style.setProperty('--share', String(share)),
    onFallback: (reason) => showPlainView(reason),
  },
});
titleElement.textContent = result.meta.title ?? 'Document'; // textContent, never markup
jumpButton.addEventListener('click', () => frame.command('jump'));
settingsButton.addEventListener('click', () => frame.command('settings'));
```

**The host page's own policy binds the frame.** A srcdoc frame inherits its embedder's Content Security Policy, so the page that uses `mountDocFrame` must not block what the frame needs:

- scripts: set no `script-src` (and no `default-src` that governs scripts), or list all four of `frameCsp()`'s hash sources in the page's own `script-src` (a nonce for the page's own scripts may sit beside them);
- style: allow inline style, with `'unsafe-inline'`, or with the hash of `frame/reader.css`'s exact text, which serves only documents with neither Mermaid nor an aligned table: Mermaid's drawings carry inline styles of their own, and an aligned table cell carries its alignment (`text-align:left`, `right` or `center`) in a `style` attribute, which no stylesheet hash admits;
- fonts and images: allow `data:` in `font-src` and `img-src` (or in `default-src`).

This version's frame policy, whose four hash sources a page's `script-src` lists:

```text
default-src 'none'; script-src 'sha256-/zwl2lcDvAbUDKBBKy52DGGac6QVMwb00PO2Yr2mXE0=' 'sha256-R9MQ0p5euUh7ZqglDr3ay7FTksxjgLlCTdA8szzHbT0=' 'sha256-zJYTt+1zsWeJ/ucqS3Jj2Qcb+9FDoWrK7x6mgrUmcP4=' 'sha256-dYWyBVujhrms/3G5yKDECzbex5whBqSqVgSMj+WYMsM='; style-src 'unsafe-inline' data:; font-src data:; img-src data:; base-uri 'none'; form-action 'none'
```

A page that blocks any of them gets a fallback; the frame is never left partly working:

1. scripts blocked, or the bootstrap's hash missing: no ready, and `onFallback('timeout')` when the watchdog runs out;
2. enhance's, the guard's or Mermaid's hash missing: ready, then the frame's error, then `onFallback('error')`; in `'after-ready'` mode, a page policy that blocks only Mermaid's hash instead leaves every figure as its source with the load note, and the frame sends no error;
3. style, fonts or images blocked: ready, then the frame's error, then `onFallback('error')`.

**Fonts.** `frame/reader.css` inlines the package's fonts, Source Serif 4 and Source Sans 3 under the SIL Open Font License 1.1, and carries their copyright lines and licence in a `/*! … */` comment that travels inside every srcdoc. A host that bundles `frame/reader.css`, or ships a srcdoc built from it (a saved page, say), ships `fonts/OFL.txt` with it, and the notices in `THIRD-PARTY-NOTICES`.

## The bridge

The frame and its parent speak over one `MessageChannel` port, protocol 1 (`BRIDGE_PROTOCOL`). Every message the frame sends is a flat object whose values are strings, except `v`; the parent refuses anything else. Of the parent's messages, `hello` and `prefs` are flat in the same way; `changes.result` carries `sha` and either `ranges`, a list of `[from, to]` pairs of integers, with or without `removedAfter`, a list of integers, or `unavailable: true` alone; and `mermaid` carries exactly one of `text`, a string of at most 8388608 UTF-16 code units (the diagram engine's build), or `unavailable: true` alone; `command` carries `name`, one of `'jump'`, `'settings'`, `'contents'`, `'outline'`, `'close-overlay'`, `'goto'` or `'print-figures'`, and nothing else, except that `'goto'` alone also carries `id`, an id in the fragment grammar, and optionally `from`, a string of at most 4096 UTF-16 code units (the frame's port parser checks that shape and no more; the reader judges the token itself, and a reader that does not know a name answers false); `appearance` carries `v: 1` and `appearance`, a plain object that the frame's port parser checks for its outer shape alone (own data properties, string keys, no `__proto__`, `constructor` or `prototype` key), the reader script running `parseAppearance` on every value it applies; the frame ignores anything else. The ops the port parser accepts are `FRAME_ACCEPTS`, the one list it reads (`hello` is not among them: it comes on the window). Of the frame's messages, `progress` carries `p`, the share read so far in thousandths: a string of the whole numbers `0` to `1000`, with no sign, point, exponent, white space or leading zero (a string outside that, a number, a missing `p` or another key is refused). The parent sends `hello` once, on the frame's window, with exactly one port; everything after it travels on that port.

| Op | Direction | Carries | Bound |
|---|---|---|---|
| `hello` | parent to frame | `v` | Once, on the window, with one port. |
| `prefs` | parent to frame | `theme`, `width`, `font` | Each optional, each one of its values. |
| `changes.result` | parent to frame | `sha`, `ranges`, `removedAfter`, or `unavailable` | Only for the one request in flight. |
| `mermaid` | parent to frame | `text`, or `unavailable` | Only to a frame whose seed draws `'after-ready'`, once, after ready; any other `mermaid` message is ignored. `text` is run as one inline script, and runs only if the frame's policy lists its hash (any of the frame's own scripts posted as `text` qualifies, runs inertly and ends in the load note); the frame takes Mermaid's API only from exactly one registration by that script; `unavailable: true` says the host has no build. |
| `command` | parent to frame | `name`, and for `'goto'` `id` and optionally `from` | One of `'jump'`, `'settings'`, `'contents'`, `'outline'` (each a toggle of that reader tool), `'close-overlay'`, `'goto'` (`id` in the fragment grammar, `from` a string of at most 4096 code units; the frame's port parser checks the shape and the reader judges the token) or `'print-figures'`; an unknown name, a non-string, a missing `id` or another key (`id` and `from` on any name but `'goto'` included) is ignored. A protocol-1 frame older than this release ignores the whole op, as it ignores every op it does not know. |
| `appearance` | parent to frame | `v`, `appearance` | `v` is the number `1`; `appearance` is a plain object (the contract's `{mode, colour?, skin?, label?}`); a value the reader's validator refuses leaves that slot out and never refuses the op. A protocol-1 frame older than this release ignores the whole op, as it ignores every op it does not know. |
| `ready` | frame to parent | `v`, `nonce` | Once; echoes the seed's nonce. The parent drops every other op before it. |
| `error` | frame to parent | `why`: `boot`, `render`, `mermaid`, `assets` or `protocol` | At most once, right after ready; terminal by itself. |
| `store.set` | frame to parent | `key`, `value` | A key on the allow-list below; JSON text of at most 64 KiB; the JSON literal `null` (the string `'null'`) deletes. |
| `navigate` | frame to parent | `href` | 1 to 4096 code units, no control character; the parent coalesces it over 250 ms. |
| `copy` | frame to parent | `text` | At most 64 KiB of UTF-8. |
| `changes` | frame to parent | `sha` | A full 40- or 64-hex sha; one in flight. |
| `hash` | frame to parent | `id`, and with `places` `push`, `from` | An id in the fragment grammar, never empty. `push` is the string `'true'` when the move is a new history entry, and absent for a replaced one; `from` is the opaque position token of the place being left, at most 4096 UTF-16 code units (`ANCHOR_LIMITS.from`), of the shape `isAnchorToken()` judges. Both are sent only when the seed's `bridge.places` is true. |
| `version` | frame to parent | `sha`, `only` | Full shas; no keys is back to the latest; the parent coalesces it over 250 ms. |
| `place` | frame to parent | `kind`: `overlay` or `overlay-closed` (`PLACE_KINDS`) | The frame's full-screen figure opened or closed (the only place); sent only when the seed's `bridge.places` is true (off unless asked for). |
| `print-figure` | frame to parent | `i`, `n`, `png` | One figure of a print run as base64 PNG text: `i` and `n` canonical decimal strings with `0 <= i < n <= 64` (`printFiguresMax`), `png` canonical base64 (`pngBytesOfBase64()` gives its decoded size) of a PNG (the text starts with `iVBORw0KGgo`, which the parser reads without decoding) of at most 1048576 bytes (`printFigurePngMaxBytes`), 16777216 bytes for a run (`printFiguresTotalMaxBytes`), no side over 2048 px (`printFigureSideMaxPx`); sent only when the seed's `bridge.printFigures` is true (off unless asked for). |
| `progress` | frame to parent | `p` | Thousandths of the share read, `'0'` to `'1000'`, no sign, point or leading zero; sent only when the seed's `bridge.progress` is true (off unless asked for), at most once per 250 ms window (`progressWindowMs`): the first value at once, the window's latest at its end. |

`OP_KEYS` lists every key each op may carry, and `ERROR_WHY` the error reasons. A `changes.result` from an older parent may omit `removedAfter`: that means no deletions. **The fragment grammar** is `FRAGMENT_ID_GRAMMAR`: `^[\p{L}\p{M}\p{N}_.:-]+$` (Unicode flag), 1 to 256 UTF-16 code units, checked by `isFragmentId()`. It covers every id the layout can go to: heading slugs, anchors, footnotes (`fnref1:1`) and defined IDs (`D2.1a`). An id outside it is never sent and never thrown on: the frame still scrolls to it, and the host's address does not record it; an `initialHash` outside it is seeded as `null`.

**Storage keys.** The frame names a key only in bridge-key space, from a closed allow-list, and the parent builds the stored key; the frame can name neither the prefix nor another document.

| Bridge key | The layout's key (namespace `docreader`) |
|---|---|
| `pref:prefs`, `pref:ui` | `docreader:prefs`, `docreader:ui` |
| `doc:pos` | `docreader:pos:doc` |
| `doc:folds`, `doc:ixfold`, `doc:marks`, `doc:outline`, `doc:seen` | `docreader:doc:doc:<field>` |

**Limits** (`BRIDGE_LIMITS`). The parent reads its limits as token buckets: 40 messages refilled at 20 a second, and of those `store.set` 10 refilled at 10 a second; one `changes` in flight, answered within 30 s; sixteen refusals close the bridge. The frame paces itself so that neither a bucket nor a strict one-second window refuses it: at most 16 messages and 8 `store.set` in any sliding 1.1 seconds (one second plus a 100 ms transit margin), the flush after ready included, with 4 of the 16 kept for `copy`. A parent that reads the limits as a strict window refuses nothing while transit jitter stays within that margin.

**Versioning.** `BRIDGE_PROTOCOL` is separate from the package's version. Protocol 1 changes only additively: a new op or an optional key, which the frame ignores and the parent drops and counts. Anything else is protocol 2, a major release. `bridgeCases()` from `./conformance` returns the wire as fixtures (`conformance/bridge-cases.json`): every message case with the verdict of its receiving side, and timed sequences for the limits, for a host's own parser of the wire.

## Highlighting: `./highlight`

The code highlighter `render()` uses, for a host that colours code itself: render with `highlight: false` (`render(markdown, { highlight: false })`), then colour each fence. `createHighlighter(options?)` makes one highlighter per document; `highlight(code, info)` answers `{ html, language, mode, charsUsed }`, and passing each fence of a document in order gives `render()`'s own code html, block for block: the language from `LANGUAGES` only (through `resolveLanguage(info)`, never guessed), a block of at most `MAX_WHOLE_BLOCK_CHARS` (256) code units highlighted whole and a longer one a line at a time, a block with a line over `MAX_LINE_CHARS` (256) left plain, and at most `MAX_DOCUMENT_CHARS` (262144) code units highlighted per document (`maxDocumentChars` changes it). `HIGHLIGHT_ENGINE` names highlight.js and its pinned version. It is pure and worker-safe, and its declarations name no highlight.js or DOM type.

## The conformance corpus: `./conformance`

The corpus is the contract: what `render()` must produce, shipped with the package so any host can check its own renderer or build against it.

| Kind | Cases | Judged by |
|---|---|---|
| golden | 37 | `conformance/corpus/<id>.md` in, `conformance/expected/<id>.html` and `.meta.json` out, compared exactly |
| hostile | 17 | a golden, plus a verdict in `conformance/hostile.json` (strings that must never appear, bounds on depth and time) |
| generated | 30 | a verdict only; the input is built from a small spec on the consumer's machine (deep nesting, long delimiter runs, huge tables, comment and heading floods, pathological code, note floods, an over-limit input, an html expansion past `maxHtmlBytes`) |

Every case is also checked by an output-safety oracle: only known tags, attributes, classes and URL schemes may appear. Code inside a highlighted block is compared as text, so a host may use another highlighter's markup.

To run it in your own CI against the renderer you ship:

```js
import { render, scanRefs } from '@synapsium-labs/pinax-lib/render';
import { runCorpus } from '@synapsium-labs/pinax-lib/conformance';

const run = runCorpus(render, { scanRefs });
for (const r of run.results) if (!r.ok) console.error(r.id, r.failures.join('\n  '));
if (!run.ok) process.exit(1);
```

`runCorpus(renderFn, { only, scanRefs, timeScale })` returns `{ ok, total, passed, results }`, one result per case with its failures. Pass `scanRefs`, or the case that bounds image scanning fails and says so. `timeScale` multiplies every time bound for a slow machine; it never changes a verdict. `loadCorpus()` returns the cases themselves, and `normaliseForCompare`, `checkOutputSafety`, `evaluateVerdict`, `buildInput`, `inputSize` and `MAX_INPUT_BYTES` are exported for hosts that judge cases their own way.

Two more sets of cases ship for a host that builds or hosts the frame itself. `bridgeCases()` returns `conformance/bridge-cases.json`, the bridge as fixtures (see the bridge, above), and throws on a file of another protocol. `conformance/frame-mutants/` holds labelled srcdoc mutants for a host's checks of a `frameDocument` output: `clean.html` is a real output with the policy and each asset's text replaced by a placeholder, and every other file is `clean.html` with exactly one defect, which `index.json` names with the check it must trip (the srcdoc's prefix and order, no URL outside the scripts, or the seed). Expand the placeholders with this version's `frameCsp()` and asset files, check that `clean.html` passes every check, and check each mutant with its own row's check.

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
| PD8 | Bounds that only hostile documents reach: short table rows add at most 65536 empty cells in the whole document; html past `maxHtmlBytes` stops with `'output-over-limit'`; and author-written `details`, `sup`, `sub` and `kbd` tags nest at most 64 open levels each, a deeper opener and the closer that pairs with it staying text (no file moves); a footnote reference's own `<sup class="footnote-ref">` is the footnote plugin's and is not counted; and a front-matter key is cut to 500 code points, as a value is. For a simple key over 1024 source characters, the reference refuses the front-matter block; this renderer loads it and cuts the key to 500 code points before escaping or emitting it. |
| PD9 | Unicode tables follow the runtime, for three surfaces. Heading ids: the slug keeps `\p{L}` and `\p{N}` and lower-cases the way the runtime does. Caption digits: a figure caption's number is a run of `\p{Nd}`. Reference labels: a label is matched by `toLowerCase().toUpperCase()`. A code point that Unicode 15.0 (the reference's Python 3.12) leaves unassigned can therefore appear in an id, count as a caption digit or fold to a match here where the reference dropped it, kept the paragraph or found no definition, and two runtimes with different Unicode versions can disagree with each other (no file moves). |

A change that moves any file under `conformance/expected/` names the moved case ids in a `Goldens-moved: <id>, <id>` commit trailer, and a hostile verdict may only tighten: `node scripts/ratchet.mjs --base <ref>` refuses anything else, and CI runs it on every change.

## Build and test

Node 22 or later. Every dependency is pinned to an exact version and installed from the committed lockfile.

```sh
npm ci                            # install exactly what package-lock.json records
npm run typecheck                 # the whole tree; src/render, src/frame and src/highlight with no host types; src/enhance, the frame runtime and src/host with the DOM
./node_modules/.bin/vitest run    # every test; one file: ./node_modules/.bin/vitest run test/package.test.ts
npm run build                     # the Mermaid files, the frame assets and their manifests, then dist/ from src/
```

- Run the local `vitest` binary, never a bare `npx vitest`, which can resolve a different global copy.
- The layout tests (`test/browser/`) run last, in real Chromium and WebKit: install them once with `npx playwright-core install --with-deps chromium webkit` (the system libraries need root); a browser that cannot start fails them, and `DOCREADER_BROWSERS=chromium` runs one browser and reports the other as excluded.
- Tests never reach a network: `test/setup/no-network.ts` makes `fetch` and every socket connect throw, and the packing test runs npm offline.
- CI (`.github/workflows/ci.yml`) installs the pinned browsers and runs those four steps on Node 22 and 24, on pull requests and on `main`, failing a run whose tests leave `conformance/layout/` changed, then the verdict ratchet against the base branch (on a push, against `main` before the push), then `npm pack` and `scripts/consumer-smoke.mjs`, which installs the tarball in a throwaway project from the registry (with `--before` set 14 days back, so its transitive dependencies obey the age rule too), typechecks a strict consumer of every code entry (`./frame` and `./highlight` also without the DOM library), checks that the exports map is exactly the public surface and that deep imports are refused, imports `./enhance`, `./frame`, `./host` and `./highlight` in Node and checks that each is import-inert and exports exactly its names, re-hashes every `assets.json` entry through `./assets/*`, builds two srcdocs with `frameDocument` from the installed files (one with Mermaid, one without) and checks their scripts against those files byte for byte, runs the srcdoc checks on them and on every labelled frame mutant, checks the font notice in the frame stylesheet, loads `bridgeCases()`, and runs the corpus through the package's public entries.
- A new or bumped dependency is an exact version at least 14 days old. Add it with
  `npm install --save-exact --before=<a date 14 days back> <name>@<x.y.z>`; npm then refuses a younger version.

### Size by contract

The frame's assets are counted in characters by two append-only tables, committed source: `conformance/size/shares.json` (each design's total and frame share, as the maintainers set it) and `conformance/size/growth.json` (the sizes measured when each landing landed, starting from the `baseline` row). Each holds one row per line, so an append never touches an earlier line, and `git log -L` over a row's line names the landing that measured it. `test/size-contract.test.ts` judges the landing, the checked-out commit, against its first parent: every earlier row is byte-equal, the newest growth row equals the recomputation from the committed `FRAME_MANIFEST`, and a design's growth stays within its share read from the parent's table.

A landing's message (or, on a pull request, its description) carries exactly one line, anywhere in it, that starts `Size-Design: `; the rest of the line is the word that says what the landing may append. A design's name (a landing that changes that design's frame assets appends one growth row naming it; one that changes none appends nothing), `none` (changes no frame asset, appends nothing), `rebaseline` (library upkeep that moves the totals: one row, counted against no design), `correction` (no asset change; two rows that move misattributed growth from one design to another), and `shares` (no asset change; share rows only). `baseline`, `none`, `rebaseline`, `correction` and `shares` are reserved words, never a design's name. A landing that lacks the line, or carries two, fails. Run it locally with `DOCSERVER_SIZE_BASE=origin/main DOCSERVER_SIZE_TEXT='Size-Design: <word>' ./node_modules/.bin/vitest run test/size-contract.test.ts`.

## Release verification

Each release is built once from a signed tag, attested, and published to npm with provenance through trusted publishing, so no token exists anywhere. The first release is 1.0.0, published as `@synapsium-labs/docserver`; the deprecated `0.0.0-reserve` and `0.0.0-stage` before it are empty placeholders of that name: the first reserved the name on npm, and npm made the second itself during that first publish. Once a version is published, a consumer verifies it with the commands the release workflow itself runs after publishing, in a scratch directory, with `VERSION` set to the version. For 1.0.0 and 1.1.0, published before the rename, read `@synapsium-labs/docserver`, `synapsium-labs-docserver-$VERSION.tgz` and `Synapsium-Labs/docserver` wherever the commands say `@synapsium-labs/pinax-lib`, `synapsium-labs-pinax-lib-$VERSION.tgz` and `Synapsium-Labs/pinax-lib`:

```sh
npm install @synapsium-labs/pinax-lib@$VERSION --ignore-scripts
npm audit signatures
npm pack @synapsium-labs/pinax-lib@$VERSION
test "$(npm view @synapsium-labs/pinax-lib@$VERSION dist.integrity)" = "sha512-$(openssl dgst -sha512 -binary synapsium-labs-pinax-lib-$VERSION.tgz | openssl base64 -A)"
gh attestation verify synapsium-labs-pinax-lib-$VERSION.tgz --repo Synapsium-Labs/pinax-lib --signer-workflow Synapsium-Labs/pinax-lib/.github/workflows/release.yml
```

`npm audit signatures` checks the registry signatures and provenance of what was installed. `npm pack` fetches the registry's own tarball of that version into the directory, as `synapsium-labs-pinax-lib-$VERSION.tgz`. The `test` line exits non-zero unless the registry's `dist.integrity`, which the install was checked against, is the `sha512-` integrity of those bytes. `gh attestation verify` then checks that the same bytes were built by this repository's release workflow and attested there; they are also the tarball attached to the GitHub release of that version. Each command must exit 0.

## Design

The design lives in the first consumer's public spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3. The programme ledger is [`docs/superpowers/programs/docserver.md`](docs/superpowers/programs/docserver.md).

## Licence

MIT. See [`LICENSE`](LICENSE). Bundled third-party files keep their own licences, listed in `THIRD-PARTY-NOTICES`: the fonts in `assets/fonts/` are Adobe's Source Serif 4 and Source Sans 3 under the SIL Open Font License 1.1.
