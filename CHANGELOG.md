# Changelog

Every published version of `@synapsium-labs/docserver`, newest first. Consumers pin one exact version, so each entry says what moved between versions: the public API, the conformance corpus (every moved golden file is named), the frame's assets, the bridge protocol and the seed schema.

How versions move:

- **Major:** an export is removed or reshaped, or the bridge protocol moves to a new number.
- **Minor:** new options, operations, exports or subpaths, and any move of a hash in `assets/assets.json`, since a host that serves the frame re-pins its page policy to the new hashes. `MAX_SRCDOC_CHARS_DEFAULT` sums the frame assets' lengths, so it moves in the same minor.
- **Patch:** fixes that move no asset hash.

`BRIDGE_PROTOCOL` and the seed's schema number are versioned on their own, apart from the package version. Every entry of a version that moves an asset names each asset's new sha256, as `assets/assets.json` records it.

Each release is built once from a signed tag, attested, and published with provenance through npm trusted publishing; the README's Release verification section gives the commands that check a published version.

## 1.1.0

A minor: new options and operations, and four asset hashes moved. Bridge protocol 1 and seed schema 1 are unchanged: the wire grows additively (the new operations are `mermaid`, `command` and `progress`), and the seed gains keys and one draw value that only its own release's bootstrap reads. An earlier 1.0.1 was prepared and never tagged; its change is folded in first below, so no 1.0.1 exists.

**A host that serves the frame re-pins its page policy to this release.** `frameCsp()` now lists a new bootstrap hash and a new enhance hash (the `csp` fields below), and `MAX_SRCDOC_CHARS_DEFAULT` moved with the assets' lengths. A host that pins the frame's page policy by hand and does not re-pin it gets no `ready`: the bootstrap is blocked, and `onFallback('timeout')` follows when the watchdog runs out.

The change prepared as 1.0.1, the directional marks and the tag characters:

- The copy check names them. `./host`'s `copy(text, { hidden })` lists U+200E LEFT-TO-RIGHT MARK, U+200F RIGHT-TO-LEFT MARK and U+061C ARABIC LETTER MARK, and every code point of the tag block U+E0000 to U+E007F by its Unicode name (`LANGUAGE TAG`, `CANCEL TAG`, `TAG LATIN SMALL LETTER G` and so on; `<reserved-E0000>` for an unassigned one). A tag character is outside the BMP, so its `index` is its first UTF-16 code unit and it takes two: a host that marks a listed character in place reads the width from `codePoint`. `onLink` refuses an href holding any of these characters, through the same table that the copy check reads.

Item A, the line and paragraph separators:

- `copy(text, { hidden })` also lists U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR. (`onLink` already refused an href holding either, as white space; it still does.) This item moves no asset hash.

Item B, Mermaid drawn after `ready`:

- `mermaidDraw` takes a third value, `'after-ready'`. The default stays `'auto'`. In this mode the frame mounts and sends `ready` with no Mermaid script in its document, every figure a readable source, and draws the figures nearest first once the host hands the build over.
- `mountDocFrame` takes `loadMermaid()`, a promise of the text of `mermaid/mermaid.frame.js`, used only with `'after-ready'` (when both it and `assets.mermaid` are given, it wins). It is called at mount, in parallel with the frame's boot, at most once per `DocFrame` and only for a document the Mermaid gate admits. Its text is checked against the bridge's size cap and the shipped build's sha256, and is posted after each mount's valid `ready`. `mountDocFrame` throws a `TypeError` for `'after-ready'` with neither `loadMermaid` nor `assets.mermaid`, or with a `loadMermaid` that is not a function.
- The new operation `mermaid` (parent to frame) carries the build, or says it is unavailable. The frame inserts it as one inline script and accepts exactly one registration, from that element. A host policy that blocks Mermaid's hash leaves the sources with the load note and the frame mounted. A host that never hands the build over leaves the root `waiting` with readable sources.
- `./enhance` has the matching draw mode, and the root's `data-docreader-diagrams` gains `waiting`.

Item C, one header bar:

- `chrome.bar: false`, which already existed (in `./enhance`'s options, and in `mountDocFrame` as `features: { chrome: { bar: false } }`), now leaves a host a working reader without the bar. New: `chrome.topSpace` (default true; `false` trims the root's top padding to 8 px on a root with no bar), and `onProgress(share)`, how far the root has been read, from 0 to 1 (in `mountDocFrame`, the `onProgress` adapter).
- `runEnhancementCommand(root, name)` and `DocFrame.command(name)` run `'jump'`, `'settings'`, `'contents'` or `'outline'` as a toggle, so a host's own buttons reach the bar's tools. `DocFrame.command(name)` throws on an unknown name. The new operations are `command` (parent to frame) and `progress` (frame to parent, at most four a second, off unless the seed's `bridge.progress` is true).
- **Hosts with the bar off now get an Aa button at the root's top right**; `chrome.settings: false` opts out of it. (Before this release the button vanished with the bar.)
- The frame's prelude sets `--bar-h: 0` for a root without a bar; `./enhance` hosts keep the documented 48 px.

The conformance corpus: `conformance/bridge-cases.json` gained the new operations' cases. Every `conformance/frame-mutants/*.html` file (17 files) moved, each changed only by the seed's new `"progress":false` key; no verdict moved, and no hostile case lost its expected verdict.

The assets that moved, each with the sha256 that `assets/assets.json` records (`assets/assets.json` also records the new `version`); `assets/frame/guard.js`, the fonts and both Mermaid builds did not move:

- `assets/frame/bootstrap.js`: `dc49ce7dffeb1d2f9ebba065ec6a53ecbdf3ab1439f67c63c17763dda459c424`, csp `'sha256-3EnOff/rHS+eu6Bl7GpT7L3zqxQ59nxjwXdj3aRZxCQ='`
- `assets/frame/enhance.js`: `daa25c84fd193dc9c8a734e6ab5705bba5d6a29fc5be73d29ed478249a9ffa7f`, csp `'sha256-2qJchP0ZPcnIpzTmq1cFu6XWop/FvnPSntR4JJqf+n8='`
- `assets/frame/reader.css`: `83176e0055183256fdd131a602f847a16a17a8944812071672550e64c8dc9e9f`
- `assets/reader.css`: `505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0`

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
