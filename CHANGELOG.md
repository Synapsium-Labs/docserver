# Changelog

Every published version of `@synapsium-labs/pinax-lib`, newest first. Versions up to 1.1.0 were published as `@synapsium-labs/docserver`, the library's name before the rename; that name gets no further version, and once the first pinax-lib version is out it is deprecated with a pointer to `@synapsium-labs/pinax-lib`. Consumers pin one exact version, so each entry says what moved between versions: the public API, the conformance corpus (every moved golden file is named), the frame's assets, the bridge protocol and the seed schema.

How versions move:

- **Major:** an export is removed or reshaped, or the bridge protocol moves to a new number.
- **Minor:** new options, operations, exports or subpaths, and any move of a hash in `assets/assets.json`, since a host that serves the frame re-pins its page policy to the new hashes. `MAX_SRCDOC_CHARS_DEFAULT` sums the frame assets' lengths, so it moves in the same minor.
- **Patch:** fixes that move no asset hash.

`BRIDGE_PROTOCOL` and the seed's schema number are versioned on their own, apart from the package version. Every entry of a version that moves an asset names each asset's new sha256, as `assets/assets.json` records it.

Each release is built once from a signed tag, attested, and published with provenance through npm trusted publishing; the README's Release verification section gives the commands that check a published version.

## Unreleased

Classic and Editorial sealed-frame layouts (a minor when released). `FRAME_LAYOUTS`, `FrameLayout` and `isFrameLayout` name the layouts. `FrameOptions.layout` and `HostAdapters.layout` select one at mount; omission keeps the default frame byte for byte. A host supplies that layout's script as `assets.enhance` and its stylesheet as `assets.layoutCss`. `frameCsp(layout)` pins one enhance hash, and `maxSrcdocChars(layout)` uses that frame's assets. The shared assets, default CSP, `MAX_SRCDOC_CHARS_DEFAULT`, sandbox, bridge protocol and seed schema do not change. Standalone `./enhance` still runs the default graph only.

- **Classic:** summary and status boxes, numbered headings, a Contents sidebar and phone drawer, and phone section chips. No review strip, Index tab or settings menu.
- **Editorial:** title block, linked standing counts, plan labels without outline controls, a running head and a Contents-only rail. Quick jump includes rules, rows and captioned figures.
- **Goldens:** no existing golden moved. The corpus adds 54 DOM snapshots for each new layout, and `conformance/frame-boundaries.json` appends the per-layout policies while keeping the earlier records intact. Review updated six of the new `rail/*.dom.txt` cases in each layout to record the drawer's Close control: `drawer`, `hostile-marks`, `malformed-mark-length`, `malformed-marks`, `marks-index` and `plan-marks`.
- `assets/frame/enhance-classic.js`: `784594145e1f448b9f79a6fb2ce1ab0e849c50168eaae43a02d1d84567e9bbae`, csp `'sha256-eEWUFF4fRIufeab7LOGrDoScUBaOquQ6AtHYRWfpu64='`
- `assets/frame/layout-classic.css`: `6c3ab827e3dcd9508f6a0e9a3130fb07294402a161c059835c385fa1c322d79a`
- `assets/frame/enhance-editorial.js`: `6aada501607c3dd80c6a8e6948a71bd8bc145f44d2cbf3702f411b0ec5a05104`, csp `'sha256-aq2lAWB8PdgMao5pSKcb2LwUX0TSy/NwL0EbDsWgUQQ='`
- `assets/frame/layout-editorial.css`: `1153110377a63b75abcfc49849cf723f825e7ce5450f1b71f16fac18ead45878`

Print mode (a minor when released): `render(md, { print: true })` writes the reader's blocks statically (the eyebrow, byline, facts panel, review strip, section numbers, boxes, status labels, plan marks and, with `reader.rules`, rule paragraphs and the rules index) inside one `div.docreader-print`, for a host that prints a document without the browser reader. New: the `print` option, `ReaderVocabulary.rules`, `assets/print.css` (every rule under `.docreader-print`; listed in `assets/assets.json`, not a frame asset), and `conformance/print/` (seven fixtures with their pinned output, and `vocabulary.json`, the elements, classes and two open class families a host derives its print allow-list from), which the package ships. `reader` is now checked whole, as the reader checks `features.vocabulary`: a list, group or grammar it would refuse is a TypeError. Without `print` the html and the meta are byte for byte what they were, and no golden moves. No frame asset changes.

The appearance contract (a minor when released): a host can hand the frame one appearance (a mode, 33 base colours, ten skin values and a label) and two optional faces, at mount and while open. Bridge protocol 1 and seed schema 1 are unchanged: the wire grows by one parent-to-frame operation, `appearance`, which an older frame ignores, and the seed by two optional keys, `appearance` and `fonts`. The version and its tag are set at release. **A host that serves the frame re-pins its page policy to the release** (the `csp` fields below), and `MAX_SRCDOC_CHARS_DEFAULT` moves with the assets and the two new seed fields' caps.

The wire, the places and the host's new adapters (a minor when released). Bridge protocol 1 and seed schema 1 are unchanged; the wire grows additively, and an older frame or host ignores or refuses what it does not know:

- **Places.** `./host`'s `onPlace(kind)` (`kind` is a `PlaceKind`, `'overlay'` or `'overlay-closed'`, exported from `./frame` with `PLACE_KINDS`) reports the frame's full-screen figure opening and closing (the only place: the keys sheet, the quick jump, the settings and the like are not); giving it sets the seed's `bridge.places` (off by default), and it is what lets the frame send a `place` message and a `hash` that carries `push` and `from`. With `onPlace`, `onHash(id, { push, from })` gets a second argument: `push` is true when the move is a new place in the host's history, `from` the opaque position token of the place left (`isAnchorToken()` and `ANCHOR_LIMITS`, new exports of `./frame`, judge and bound it); a host without `onPlace` is called with the id alone, as before. A `place`, or a `hash` with `push` or `from`, that reaches a host that did not ask is refused and counted.
- **Commands.** `DocFrame` gains `closeOverlay()` (closes the full-screen figure, needs `onPlace`), `goto(id, from?)` (takes the reader to the place `id`, from the token `from`; a bad `id` or `from`, or no `onPlace`, is a `TypeError`) and `printFigures()` (see below). Each posts once the frame is ready and does nothing before it, after a fallback or after `destroy()`, and moves no focus. On the wire the `command` operation takes `close-overlay`, `goto` (with `id` and `from`) and `print-figures`; `DocFrame.command(name)` still runs the four tools only. In `./enhance`, `runEnhancementCommand(root, name, args?)` takes a third argument (`goto` reads `{ id, from }` from it), `onPlace` is a reader option, and `goToHash(root, id, from?)` is `onHash`'s other half.
- **Print figures.** `onPrintFigure` and `printFigures()` as below; `pngBytesOfBase64()` and four `BRIDGE_LIMITS` entries (`printFiguresMax`, `printFigureSideMaxPx`, `printFigurePngMaxBytes`, `printFiguresTotalMaxBytes`) are new in `./frame`. The seed's `bridge` gains `places` and `printFigures`, both off by default.
- **Item values and item links.** `render()`'s `meta.items` lists the item values (`AB-12`) the reader would ask its host `itemLink` for, in document order; it is always present, an empty array for a document that names none, and is a new key of every `meta`. `RenderMeta.items` is a required field of the type, so code that builds a `RenderMeta` itself (for example a custom `RenderFn` handed to `runCorpus`) must add `items` (an empty array will do) or fail to typecheck. The new `RenderOptions.reader` takes the reader's vocabulary (`ReaderVocabulary`, validated whole) and reads the three places an item can be named: the byline's item fact, the delta line, and a header line before the meta line (a strong label from `itemFields`, a colon, then keys; this third route is the reference reader's own and is on only when `itemFields` names a label). `./host` gains `HostAdapters.items(values)`, a synchronous resolver called at each mount with `meta.items`, whose links (at most 50 `{ value, href }`, absolute `https:` hrefs) are seeded as the new optional seed key `items`; `frameDocument` takes `items` directly. A refused answer seeds nothing and the items stay text.
- **In short and the comparison base.** `features.inShort` (default false) turns on the "Headlines / Full" switch of the "In short" box; the choice is kept in the reader's UI memory. `HostAdapters.changesBase` (a full sha) and the seed's new optional key `changesBase` make the reader ask `changes` once for that comparison at the start and show it as a chosen comparison, without moving the reader. A host records a base only for a comparison the reader chose, not for the automatic last-visit measure or a day view, which are asked through `changes` too.
- **The size contract.** The seed's own bundled check of `features.vocabulary` is now an outer shape check; the words are judged on the host side (`frameDocument` refuses a bad word list with the same message) and again in the reader, so a seed edited after `frameDocument` fails the frame's render and the host falls back. `SEED_FIELDS_MAX_CHARS` and `MAX_SRCDOC_CHARS_DEFAULT` rise by the new keys at their caps. The frame's total is 4 571 331 characters (design `x2`'s first row in `conformance/size/growth.json`), the bootstrap 32 740 bytes of 32 768.
- **Fixes.** A jump's history entry is no longer lost to a move within 100 ms of it (the frame keeps `push` and the first push's `from` when it merges), and a print run ends only at the next `printFigures()` or at unmount, not at its last index. A commit named by a long base, or the reverse, is matched only from 7 characters (`baseLabel`).
- **Goldens.** None moved. One existing fixture was edited, not added: in `conformance/bridge-cases.json`, "a key outside the op set" (a `hash` message with a key the op does not have) now carries the key `replace` where it carried `push`, which the `hash` op now accepts; the verdict, `refuse` for `keys`, is unchanged. New fixtures are additions: `conformance/bridge-cases.json` gains the place, hash, command and print-figure cases (and an optional `given` field that states the mount's state for a case whose verdict depends on it), `conformance/frame-boundaries.json` a third entry, and `conformance/print/` the print fixtures.
- **Known limit.** Safari: a byline with very many separators is slow. In WebKit, building the screen's byline and undoing it grow faster than linearly in the number of its separators. CI measured (runs 44908932707 and 44912462614, both Node legs), at 4 000 separators in 5 text nodes and 10 000 in 2: build 0.33 to 0.59 s and 1.5 to 2.4 s, undo 0.32 to 0.72 s and 1.8 to 5.2 s. Chromium builds 32 000 in 1.2 to 1.3 s and undoes them in 0.06 to 0.08 s. A byline of the size real documents have (tens of separators) is not affected. Two fixes did not make it linear: a separator scan that never slices the remaining text, and a build and undo done with the paragraph off the document. The cause inside WebKit is not identified; finding it needs a WebKit profile.

Print figures (a minor when released): with the host's `onPrintFigure` (the seed's `bridge.printFigures`) the reader gains the `print-figures` command. The reader draws each Mermaid figure again for print, offscreen and with HTML labels off, rasterises it to a PNG (at most 2048 px a side and 1 MiB, at most 64 figures) and sends `print-figure { i, n, png }` in document order, one at a time through the frame's pacer; a figure that fails to draw, taints the canvas or is too large is skipped, and a second command cancels the first run's remaining figures, and the host's run absorbs any figure of the cancelled run still in the port's queue: in a run opened while the previous one was unfinished (or itself reopened; a run after a complete ordinary run is ordinary), the first repeat of an index replaces the earlier copy (handed to `onPrintFigure` again, so the latest copy of an index wins; no refusal; the run's byte total adjusted before the 16 MiB check). The host's parser now also refuses a `print-figure` whose text does not start with the base64 of the PNG signature (`type`, read from the text, nothing decoded). (The jump's history entry fix in this release's Fixes bullet is the frame's `hash` op, not part of print figures.) Goldens: none moved; `conformance/bridge-cases.json` gains `print-figure` fixtures and its size fixtures start with the PNG signature. The known limits of a reprint:

- (a) If the new run skips an index (a figure it could not draw), the earlier copy of that index stays, in the earlier colours if the appearance changed in between.
- (b) A reprint can cost refusals in two cases only, and refusals never decay on a mount:
  1. **The oversize edge.** Near the 16 MiB total, stale copies still counted can make a new copy refused as oversize, and counted, the consumer keeping that index's earlier copy. Two triggers: stale copies larger than their replacements (drawn before an appearance change, say), and stale copies of indexes the new run never replaces (a figure it could not draw, or one it skipped at its own 16 MiB total). Several can be refused this way, and in an extreme skew enough to close the frame.
  2. **Three runs' figures in flight at once** (two presses before the host has drained its port). One cause, two effects: a third copy of one index is refused and counted (the copy refused is the run's own, so the consumer keeps a stale copy of that index); and, with figure sizes that change between those runs, an honest copy can be refused by the 2 x 16 MiB cap on what a run hands on. Sixteen such third-copy refusals close the frame, as any sixteen refusals do.
- (c) Bounds per run: the latest copy of each index is at most 16 MiB in all; a run hands on at most 2n figures (each index at most twice) and at most 2 x 16 MiB in all, replaced copies counted. A figure past either cap is refused before decode and counted.

The frame assets' sizes are now held by two append-only tables, `conformance/size/shares.json` and `conformance/size/growth.json`, judged at every landing against its first parent by `test/size-contract.test.ts` through one `Size-Design:` line in the landing's message; `FRAME_MANIFEST` entries gain a `layout` field (`"default"` for the enhance bundle, `null` for the rest).

- `assets/frame/bootstrap.js`: `47d310d29e5eb9487b66a8250ebddacbb15392cc6380b9424dd03cb33cc76d3d`, csp `'sha256-R9MQ0p5euUh7ZqglDr3ay7FTksxjgLlCTdA8szzHbT0='`
- `assets/frame/enhance.js`: `cc9613b7ed73b16789fee72a4b7263d9071bfbd143a16acaef1ea682b52670fe`, csp `'sha256-zJYTt+1zsWeJ/ucqS3Jj2Qcb+9FDoWrK7x6mgrUmcP4='`
- `assets/frame/reader.css`: `367c2b55a35c4907c9aa775ce8a3c389b0f8bd38c0f9e1ed51f634d225a881a2`
- `assets/reader.css`: `3f6dd64e41431f9f052a4c682455728b5a872551938f7ea07708dde8667ddf9e`
- `assets/print.css`: `2ba6cfdc58eaf2e5bced8b767eb85fb3255bcd1c9a23ee1e62ee5add4bfb6113`

## 1.1.0

A minor: new options and operations, and four asset hashes moved. Bridge protocol 1 and seed schema 1 are unchanged: the wire grows additively (the new operations are `mermaid`, `command` and `progress`), and the seed gains keys and one draw value that only its own release's bootstrap reads. An earlier 1.0.1 was prepared and never tagged; its change is folded in first below, so no 1.0.1 exists.

**A host that serves the frame re-pins its page policy to this release.** `frameCsp()` now lists a new bootstrap hash and a new enhance hash (the `csp` fields below), and `MAX_SRCDOC_CHARS_DEFAULT` moved with the assets' lengths. A host that pins the frame's page policy by hand and does not re-pin it gets no `ready`: the bootstrap is blocked, and `onFallback('timeout')` follows when the watchdog runs out.

The change prepared as 1.0.1, the directional marks and the tag characters:

- The copy check names them. `./host`'s `copy(text, { hidden })` lists U+200E LEFT-TO-RIGHT MARK, U+200F RIGHT-TO-LEFT MARK and U+061C ARABIC LETTER MARK, and every code point of the tag block U+E0000 to U+E007F by its Unicode name (`LANGUAGE TAG`, `CANCEL TAG`, `TAG LATIN SMALL LETTER G` and so on; `<reserved-E0000>` for an unassigned one). A tag character is outside the BMP, so its `index` is its first UTF-16 code unit and it takes two: a host that marks a listed character in place reads the width from `codePoint`. `onLink` refuses an href holding any of these characters, through the same table that the copy check reads.

Item A, the line and paragraph separators:

- `copy(text, { hidden })` also lists U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR. (`onLink` already refused an href holding either, as white space; it still does.) This item moves no asset hash.

Item B, Mermaid drawn after `ready`:

- `mermaidDraw` takes a third value, `'after-ready'`. The default stays `'auto'`. In this mode the frame mounts and sends `ready` with no Mermaid script in its document, every figure a readable source, and draws the figures once the host hands the build over, in `'auto'`'s order: the figures within one and a half screens of the reader first, in document order, then the rest by distance. (A figure in view can wait behind earlier figures up to one and a half screens away.) The write that turns drawing on is kept like each figure's own, so the reader's place in the text does not move at the handover.
- `mountDocFrame` takes `loadMermaid()`, a promise of the text of `mermaid/mermaid.frame.js`, used only with `'after-ready'` (when both it and `assets.mermaid` are given, it wins). It is called at mount, in parallel with the frame's boot, at most once per `DocFrame` and only for a document the Mermaid gate admits. Its text is checked against the bridge's size cap and the shipped build's sha256, and is posted after each mount's valid `ready`. `mountDocFrame` throws a `TypeError` for `'after-ready'` with neither `loadMermaid` nor `assets.mermaid`, or with a `loadMermaid` that is not a function.
- The new operation `mermaid` (parent to frame) carries the build, or says it is unavailable. The frame inserts it as one inline script and accepts exactly one registration, from that element. A host policy that blocks Mermaid's hash leaves the sources with the load note and the frame mounted. A host that never hands the build over leaves the root `waiting` with readable sources.
- `./enhance` has the matching draw mode, and the root's `data-docreader-diagrams` gains `waiting`.

Item C, one header bar:

- `chrome.bar: false`, which already existed (in `./enhance`'s options, and in `mountDocFrame` as `features: { chrome: { bar: false } }`), now leaves a host a working reader without the bar. New: `chrome.topSpace` (default true; `false` trims the root's top padding to 8 px on a root with no bar), and `onProgress(share)`, how far the root has been read, from 0 to 1 (in `mountDocFrame`, the `onProgress` adapter).
- `runEnhancementCommand(root, name)` and `DocFrame.command(name)` run `'jump'`, `'settings'`, `'contents'` or `'outline'` as a toggle, so a host's own buttons reach the bar's tools. `DocFrame.command(name)` throws on an unknown name. The new operations are `command` (parent to frame) and `progress` (frame to parent, at most four a second, off unless the seed's `bridge.progress` is true).
- **Hosts with the bar off now get an Aa button at the root's top right**; `chrome.settings: false` opts out of it. (Before this release the button vanished with the bar.)
- The frame's prelude sets `--bar-h: 0` for a root without a bar; `./enhance` hosts keep the documented 48 px.
- On a root with no bar, the settings menu's height is bounded to its viewport (`max-height: calc(100vh - 80px)`, which keeps its bottom inside the frame from the top of the document and once Aa is stuck), where it ran up to 47 px past the bottom of a short frame. This applies to every root with no bar, framed or not.
- On a root with no bar that carries Aa, the sticky figure tools and a table's sticky head stick below Aa's box: the head at `max(var(--bar-h), 50px)` and the tools at `max(calc(var(--bar-h) + 6px), 50px)`, so Aa no longer covers the right end of their hit areas, and a host that sets `--bar-h` to the height of its own fixed header keeps its offset when that is larger. `--bar-h` stays 0 in the frame; a root with a bar, and a root with `chrome.settings: false` (no Aa), are unchanged. A jump to a table row (an in-document link, the quick jump, a card, a glossary term or an Index entry) clears the head stuck below Aa.
- On every host and for every feature, a run of kept layout changes no longer drifts the reading block on an engine that truncates scroll fractions (WebKit): a keep reuses the offset the last restore aimed at while the scroll position is unchanged and the block is less than a pixel off, so the error stays under one engine step however many changes are kept, on an engine whose scroll step is at most one CSS pixel. At browser zoom below 100% (a step above one CSS pixel) the drift adds up as it did before, no worse.
- In the settings menu, a `focusout` that names no element (the window loses focus, or Tab leaves the document) no longer closes Aa, on every host, bar on or off; focus moving to another element outside the menu, and Aa's own button, still close it.
- A host command (`DocFrame.command('settings')` and the rest) is no longer swallowed by a stale flag after a tap inside the reader: a tap on a card's trigger while Aa is open no longer leaves a flag that makes the host's next `settings` command answer true and open nothing. A click inside the reader's root ends the gesture; a host button placed inside the root loses the same-gesture toggle, so a host keeps its own buttons outside the root, as the documented layout does.

The conformance corpus: `conformance/bridge-cases.json` gained the new operations' cases. Every `conformance/frame-mutants/*.html` file (17 files) moved, each changed only by the seed's new `"progress":false` key; no verdict moved, and no hostile case lost its expected verdict.

The assets that moved, each with the sha256 that `assets/assets.json` records (`assets/assets.json` also records the new `version`); `assets/frame/guard.js`, the fonts and both Mermaid builds did not move:

- `assets/frame/bootstrap.js`: `dc49ce7dffeb1d2f9ebba065ec6a53ecbdf3ab1439f67c63c17763dda459c424`, csp `'sha256-3EnOff/rHS+eu6Bl7GpT7L3zqxQ59nxjwXdj3aRZxCQ='`
- `assets/frame/enhance.js`: `6bcf14892e483f442f701c0ca9ff521c86e482c219485102b81927db9070eb64`, csp `'sha256-a88UiS5IP0QvcBwMqf9SHIbkgsIZSFECuBkn25Bw62Q='`
- `assets/frame/reader.css`: `b065ff8f9e7d20cfd39bd33b9d4be8414554d4c2bfec8d18636efecad83f5c97`
- `assets/reader.css`: `9643075331610addc88df72d55289be749fb4c991607c96c22f7bde63e22eeb5`

## 1.0.0

The first release. Bridge protocol 1, seed schema 1. It holds:

- `./render` and `./conformance`: the pure Markdown renderer and its conformance corpus, with the hostile cases and their verdicts.
- `./enhance`: the rich reading layout, which a host runs in its own page.
- `./frame`: `frameDocument`, which builds the sealed reader frame's document as a pure string, with the protocol constants, the frame policy builder and checker, the asset manifest and the fragment grammar.
- `./host`: `mountDocFrame`, the reference parent that mounts the frame for other viewers.
- `./highlight`: code highlighting for a host that renders without the built-in highlighter.
- `assets/`: the stylesheet, the fonts, the frame's scripts and stylesheet, both Mermaid builds (12.1.0), and `assets/assets.json`, which lists every shipped asset with its sha256 and size.

Its assets, each with the sha256 that `assets/assets.json` records:

- `assets/fonts/OFL.txt`: `18aabf190848725e2576eefb5c29ba06aac1029d02132252a7f312eac2e50cf3`
- `assets/fonts/README.md`: `cfd817cfc6a573679d6961ed40a410b9c0c87ccd1af8bdce2d28c00846e314e9`
- `assets/fonts/source-sans-3-latin-wght-italic.woff2`: `9a15dafc2c2b2414aaa9d6c30830d9aab4361329d8495b1574633603b994b411`
- `assets/fonts/source-sans-3-latin-wght-normal.woff2`: `7a19a7027e125257d310c6dbd78ae3a30b5ea1e3794d60b12bb28227a003bfda`
- `assets/fonts/source-serif-4-latin-opsz-italic.woff2`: `96e6393209728ab93c334ae739af8a040cd2006c82e8614d6465a8084db88f89`
- `assets/fonts/source-serif-4-latin-opsz-normal.woff2`: `f2ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0`
- `assets/frame/bootstrap.js`: `7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c`
- `assets/frame/enhance.js`: `0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929`
- `assets/frame/guard.js`: `ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d`
- `assets/frame/reader.css`: `99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489`
- `assets/mermaid/mermaid.frame.js`: `7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3`
- `assets/mermaid/mermaid.mjs`: `dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df`
- `assets/reader.css`: `901ccd09d3377419f7db51e97ce336bfacb3a22d89030d72d604d61e7d12bca2`

## 0.0.0-reserve

An empty placeholder, published once by hand and deprecated, that reserved the package name on npm so that the trusted publisher could be attached before 1.0.0. It holds no code; install 1.0.0 or later.

## 0.0.0-stage

An empty placeholder that npm made itself during the first publish of the package ("Temporary package placeholder for staged publishing"), deprecated. It holds no code; install 1.0.0 or later.
