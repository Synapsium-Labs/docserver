# Changelog

Every published version of `@synapsium-labs/docserver`, newest first. Consumers pin one exact version, so each entry says what moved between versions: the public API, the conformance corpus (every moved golden file is named), the frame's assets, the bridge protocol and the seed schema.

How versions move:

- **Major:** an export is removed or reshaped, or the bridge protocol moves to a new number.
- **Minor:** new options, operations, exports or subpaths, and any move of a hash in `assets/assets.json`, since a host that serves the frame re-pins its page policy to the new hashes. `MAX_SRCDOC_CHARS_DEFAULT` sums the frame assets' lengths, so it moves in the same minor.
- **Patch:** fixes that move no asset hash.

`BRIDGE_PROTOCOL` and the seed's schema number are versioned on their own, apart from the package version. Every entry of a version that moves an asset names each asset's new sha256, as `assets/assets.json` records it.

Each release is built once from a signed tag, attested, and published with provenance through npm trusted publishing; the README's Release verification section gives the commands that check a published version.

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
