# Changelog

Every published version of `@synapsium-labs/docserver`, newest first. Consumers pin one exact version, so each entry says what moved between versions: the public API, the conformance corpus (every moved golden file is named), the frame's assets, the bridge protocol and the seed schema.

How versions move:

- **Major:** an export is removed or reshaped, or the bridge protocol moves to a new number.
- **Minor:** new options, operations, exports or subpaths, and any move of a hash in `assets/assets.json`, since a host that serves the frame re-pins its page policy to the new hashes. `MAX_SRCDOC_CHARS_DEFAULT` sums the frame assets' lengths, so it moves in the same minor.
- **Patch:** fixes that move no asset hash.

`BRIDGE_PROTOCOL` and the seed's schema number are versioned on their own, apart from the package version. Every entry of a version that moves an asset names each asset's new sha256, as `assets/assets.json` records it.

Each release is built once from a signed tag, attested, and published with provenance through npm trusted publishing; the README's Release verification section gives the commands that check a published version.

## Unreleased

Nothing is published yet. The first published version will be 1.0.0, and its entry will name every asset hash it ships. It will hold:

- `./render` and `./conformance`: the pure Markdown renderer and its conformance corpus, with the hostile cases and their verdicts.
- `./enhance`: the rich reading layout, which a host runs in its own page.
- `./frame`: `frameDocument`, which builds the sealed reader frame's document as a pure string, with the protocol constants, the frame policy builder and checker, the asset manifest and the fragment grammar.
- `./host`: `mountDocFrame`, the reference parent that mounts the frame for other viewers.
- `./highlight`: code highlighting for a host that renders without the built-in highlighter.
- `assets/`: the stylesheet, the fonts, the frame's scripts and stylesheet, both Mermaid builds (12.1.0), and `assets/assets.json`, which lists every shipped asset with its sha256 and size.
