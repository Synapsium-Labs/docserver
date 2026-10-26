# docserver

One shared renderer for spec and plan documents written in Markdown. It turns Markdown into the rich reading layout: a contents sidebar, "In short" and "Where things stand" boxes, status labels, figure cards for Mermaid diagrams, quick jump, a glossary on hover, an Index of defined IDs, "Changes since", read marks, and light and dark themes.

It is pure. It does no network, storage, auth, git or hosting. Each product that uses it brings its own transport, login, content source and hosting, and pins one exact version.

**Status:** the render and conformance entries are delivered. L2 navigation, reader state, editorial and review layout features are implemented in this working tree; diagram tools are still completing. Final L2 browser, consumer, parity and whole-branch acceptance remains pending. L3 owns frame construction, host mounting, the asset manifest and release work.

## What it holds

| Part | Entry point | Stage |
|---|---|---|
| Markdown rules (markdown-it, TypeScript): GitHub-style Markdown, alerts, figure captions, front matter, heading ids, a short raw-HTML allowlist | `@synapsium-labs/docserver/render`: `render()`, `scanRefs()` | Delivered |
| The conformance corpus: Markdown in, expected HTML out, plus hostile cases | `@synapsium-labs/docserver/conformance`: `runCorpus()`, `loadCorpus()` | Delivered |
| The rich layout over a rendered document: lifecycle, host adapters, reader prefs, navigation, reading position, state, editorial and index views, menus, comparison UI and read marks | `@synapsium-labs/docserver/enhance`: `enhance()`, `destroyEnhancement()`, `goToHash()`, `setEnhancementPrefs()`, `EnhanceError` | L2 implementation; final acceptance pending |
| The layout stylesheet and package fonts | `@synapsium-labs/docserver/assets/*`: `assets/reader.css`, `assets/fonts/` | L2 implementation; final acceptance pending |
| Self-hosted Mermaid and diagram controls | `@synapsium-labs/docserver/assets/mermaid/*` through `mermaid.load()` | Still completing; final behavioral verification pending |
| A sandboxed-frame document builder, a host helper and asset manifest | `frameDocument()`, `mountDocFrame()`, `assets.json` | L3 |

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
// Link @synapsium-labs/docserver/assets/reader.css as a stylesheet, or import it where a bundler handles CSS
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

**`enhance(root, options?)`** returns a `Promise<void>` that resolves once the layout is built. Importing the entry does nothing: no DOM, storage, timer or network is touched until `enhance` is called. The library owns `root` and what it creates inside it; outside it, it only listens for `beforeprint` and `afterprint` on the root's window, to show folded sections in print. It marks `root` with `data-docreader-root` (the stylesheet's scope) and the prefs as `data-theme` (absent for `auto`, so the system colour scheme applies), `data-width` and `data-font`; the product lens is the root class `lens-product`. Every element it creates carries `data-docreader-chrome`. The root can additionally carry feature-state classes such as `has-toc`, `toc-open`, `bar-hidden`, `outline` and `ver-on`, and Mermaid progress is exposed as `data-docreader-diagrams` with `drawing`, `drawn`, `partial` or `failed`. These markers are reader-owned and are removed or conditionally restored by `destroyEnhancement`.

The document's own nodes are never re-created and their text is never re-typed: they are moved, and where a word moves into a mark or a number its text node is split in two without changing a character. On the document's own elements the reader also sets `hidden` (the meta line, folded blocks), `aria-label` (headings), `data-label` (the cells of a table that stacks on a phone) and classes (`folded` on headings; `stack` and `cols-2` on table wrappers; `group` on table rows). Destroy joins every split and restores every attribute and class. It never writes `document.title`, `location`, `history` or any storage API, never looks an element up by a document id, and writes no HTML strings, so ordinary enhancement runs under a strict Content Security Policy. Mermaid drawing needs the reader policy's `style-src 'unsafe-inline'` for Mermaid's styles; scripts remain restricted to the page origin. Its type declarations name DOM types, so a TypeScript consumer of `./enhance` needs the DOM library (`"lib": ["ES2022", "DOM"]`, say).

| Option | Default | Meaning |
|---|---|---|
| `prefs` | none | Starting prefs (`theme`: `auto`, `light` or `dark`; `width`: `standard` or `wide`; `font`: `serif` or `sans`; `lens`: `all` or `product`, the reading lens, which quiets implementation detail without removing it). They override stored prefs and are not written back. |
| `storage` | none | The host's storage: `snapshot`, what it holds under this reader's keys, read during startup only; and `set(key, value)`, called after each local change (`null` deletes). Without it nothing persists and the reader still works. |
| `storageKey` | none | This document's key namespace, such as `project-a:specs:example.md`: a non-empty string of at most 1024 code units. Without it no per-document state persists. |
| `posKey` | `storageKey` | The key namespace of this document's reading position, so a host can store the position apart from the rest (per tab, say): a non-empty string of at most 1024 code units. Without it or `storageKey` the position has no key. |
| `info` | from the DOM | `{ title, frontList, sha, draft, commits, only }`. `title` and `frontList` as `render()`'s `meta` holds them; without them the title is the root's first `h1`. `sha` is the commit of the version shown; `draft` says the version shown is not a commit (default `false`); `commits` lists the document's commits, newest first, as `{ sha, subject, date, parents }` (`date` is text the reader shows as given, such as an ISO 8601 date; its form is not checked); and `only` is the base commit of a one-day view: the version at `sha`, with the changes since `only` marked. A sha is 7 to 40 hex characters, or exactly 64, in either case, and is kept in lower case. Only the first 100 commits are read, a subject is cut to 200 code units, and the first 16 parents are kept; a date over 64 code units refuses the options. `frontList` keeps its first 40 entries and each `vals` its first 300 items, as `render()` bounds them. |
| `folds` | `true` | Section folding. |
| `keyboard` | `true` | Single-key shortcuts. |
| `chrome` | each `true` | `{ bar, rail, settings }`: which parts of its own chrome the reader builds: the bar at the top of the root, the contents rail (a drawer on a narrow screen), and the reading settings menu. A host with a bar of its own turns `bar` off. |
| `rules` | `false` | Rule paragraphs and the rules index. |
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

**Host callbacks.** `onLink`, `onHash`, `copy`, `changes`, `openVersion`, `itemLink` and `mermaid.load` are the host's adapters for what the reader must not do itself: follow a link, change the address, use the clipboard, fetch, or load a module. Each must be a function in an own data property. Reading the options never calls one, nor reads anything from it. The reader calls it later as a method of the object it came from (the options object, or `mermaid` for `load`), only while the root is enhanced and only from inside one of its own actions, so a destroy requested from inside a callback takes effect when the callback returns. A callback that throws, or (for `copy`, `changes` and `load`, whose promises the reader waits for) whose promise rejects, counts as failed and the reader carries on; nothing is called once a destroy has begun, and a reply that arrives after it, or from a callback that requested it, is ignored. Each object the reader hands a callback (`{ newTab }`, `{ push, from }`, `{ sha, only }`) is a new frozen object, and whatever a callback returns is checked before use. Whether a callback was given decides what the reader builds (no Copy buttons without `copy`, say), never what it returns. The reader calls the function itself, never a `call` property of it. A promise's machinery is not one of the reader's actions: the `then` of a thenable a callback returns, and any getter on what it resolves with, run outside them, so a destroy requested there takes effect at once, and the reply is ignored.

One root has one owner: calling `enhance` again on an enhanced root with the same options object (or with options omitted both times) returns the same promise; other options, or a root inside or around an enhanced one, reject with `'ownership'`. That check runs again once the options are read, so host code that runs while they are read (a Proxy's traps) cannot make a second owner. Keep an enhanced root in its document: `destroyEnhancement` and `setEnhancementPrefs` still find a root that was moved to another one, and a root inside it is still refused, but a root around it there is not. A destroy or abort during startup rejects with `'aborted'`, and a failure with `'initialization'`; either rejection comes after everything built so far has been undone.

**`destroyEnhancement(root)`** returns a `Promise<void>` that settles once cleanup has finished. Everything `enhance` did is undone, in reverse: what it created is removed, the document's nodes go back where they were, and every attribute and class it wrote is restored, unless the host has changed that value since, in which case the host's value stays. An attribute the library removed comes back at the end of its element's attribute list, so a serialization can differ in attribute order only; that happens to a `data-theme` the host put on the root itself, which the reader owns while enhanced (pass `prefs` instead). If the host removes or merges the node that followed one the reader moved (`root.normalize()` merges the separators left in the hidden meta line, say), that node still goes back into its old parent, next to where it was, and the promise rejects with an `AggregateError` that says so. A destroy requested from inside one of the reader's own actions (a `set` call, say) stops that action at once, so nothing more is written, and the cleanup runs as the action returns. It does not wait for a pending `set` promise, and issues no new call. Repeated calls return the same promise; a root never enhanced resolves at once. If a cleanup step throws, the others still run and the promise rejects with an `AggregateError`; the root is released either way.

**`setEnhancementPrefs(root, prefs)`** changes the prefs of an enhanced root at once and writes them behind. A bad value throws `'invalid-options'`; a root that is not enhanced is left alone. A change made while `enhance` is still starting (waiting for an earlier destroy of the same root, say) is kept and applied as soon as it builds.

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
| Classic variants, sibling-link rewrites and auto-bootstrap are absent | `src/enhance/index.ts`, `src/enhance/nav.ts` | `test/enhance-walls.test.ts`, `test/enhance-scrub.test.ts` |
| Hosted-font allowances and ready gates are not part of the library | `assets/reader.css`, `src/enhance/relayout.ts` | `test/enhance-styles.test.ts`, `test/enhance-relayout-baseline.test.ts` |

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
| PD8 | Bounds that only hostile documents reach: short table rows add at most 65536 empty cells in the whole document; html past `maxHtmlBytes` stops with `'output-over-limit'`; and author-written `details`, `sup`, `sub` and `kbd` tags nest at most 64 open levels each, a deeper opener and the closer that pairs with it staying text (no file moves); a footnote reference's own `<sup class="footnote-ref">` is the footnote plugin's and is not counted; and a front-matter key is cut to 500 code points, as a value is. For a simple key over 1024 source characters, the reference refuses the front-matter block; this renderer loads it and cuts the key to 500 code points before escaping or emitting it. |
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
- The layout tests (`test/browser/`) run last, in real Chromium and WebKit: install them once with `npx playwright-core install --with-deps chromium webkit` (the system libraries need root); a browser that cannot start fails them, and `DOCREADER_BROWSERS=chromium` runs one browser and reports the other as excluded.
- Tests never reach a network: `test/setup/no-network.ts` makes `fetch` and every socket connect throw, and the packing test runs npm offline.
- CI (`.github/workflows/ci.yml`) installs the pinned browsers and runs those four steps on Node 22 and 24, on pull requests and on `main`, failing a run whose tests leave `conformance/layout/` changed, then the verdict ratchet against the base branch (on a push, against `main` before the push), then `npm pack` and `scripts/consumer-smoke.mjs`, which installs the tarball in a throwaway project from the registry (with `--before` set 14 days back, so its transitive dependencies obey the age rule too) typechecks a strict consumer of the three code entries, imports `./enhance` in Node, resolves the stylesheet and the font licence through `./assets/*`, checks that deep imports are refused, and runs the corpus through the package's public entries.
- A new or bumped dependency is an exact version at least 14 days old. Add it with
  `npm install --save-exact --before=<a date 14 days back> <name>@<x.y.z>`; npm then refuses a younger version.

## Design

The design lives in ccrc's spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3. The programme ledger is [`docs/superpowers/programs/docserver.md`](docs/superpowers/programs/docserver.md).

## Licence

MIT. See [`LICENSE`](LICENSE). Bundled third-party files keep their own licences, listed in `THIRD-PARTY-NOTICES`: the fonts in `assets/fonts/` are Adobe's Source Serif 4 and Source Sans 3 under the SIL Open Font License 1.1.
